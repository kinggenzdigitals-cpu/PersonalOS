"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteURL } from "@/lib/site";
import { PLAN_PRICES, type BillingPeriod } from "@/lib/plans";
import { getActiveOffer } from "@/lib/promo";
import { PROMO } from "@/lib/promo-config";
import { LIFETIME_OFFER } from "@/lib/offer-config";
import { resolveLifetimeOffer } from "@/lib/offer";
import { getEntitlement } from "@/lib/entitlement";
import { checkoutBlockReason } from "@/lib/checkout-eligibility";
import {
  INVALID_PROMO_MESSAGE,
  isRedeemable,
  ownRedemptionAction,
  pendingCutoffIso,
  promoAttemptBlocked,
  PROMO_GLOBAL_WINDOW_MS,
  PROMO_USER_WINDOW_MS,
} from "@/lib/promo-redemption";
import { friendlyDbError, isSchemaMissing, migrationRequired } from "@/lib/supabase/errors";
import type { PromoRedemption } from "@/lib/supabase/types";
import { createPaymongoCheckout, paymongoConfigured } from "@/lib/paymongo";
import {
  buildLifetimeReference,
  buildPromoReference,
  buildSubscriptionReference,
} from "@/lib/billing-reference";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export type PromoCheckoutResult =
  | { ok: true; free: true; message: string }
  | { ok: true; free: false; url: string }
  | { ok: false; error: string };

type PaidPlan = "pro" | "premium";

const PERIOD_LABEL: Record<BillingPeriod, string> = {
  monthly: "Monthly",
  quarterly: "3 months",
  semiannual: "6 months",
  annual: "1 year",
};

function cleanPromoCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function addMonthsIso(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Writes this account's redemption of a code: a new row, or, when resuming an
 * unpaid checkout, that same row (unique (promo_code_id, user_id) allows only
 * one). The database refuses either past max_redemptions (0029). Returns the
 * error to show, or null.
 */
async function writeRedemption(
  admin: Admin,
  promoCodeId: string,
  userId: string,
  resumed: { id: string; status: PromoRedemption["status"] } | null,
  values: {
    status: "pending" | "active";
    amount_paid: number;
    invoice_external_id?: string;
    redeemed_at?: string;
    access_starts_at?: string;
    access_expires_at?: string;
  },
): Promise<string | null> {
  const { data, error } = resumed
    ? await admin
        .from("promo_redemptions")
        .update(values)
        .eq("id", resumed.id)
        .eq("status", resumed.status)
        .select("id")
    : await admin
        .from("promo_redemptions")
        .insert({ promo_code_id: promoCodeId, user_id: userId, ...values })
        .select("id");
  if (error) {
    return error.message.includes("promo_cap_reached")
      ? "That promo code has reached its limit."
      : friendlyDbError(error, "Couldn't redeem that promo code. Please try again.");
  }
  // The resumed row changed status between the read and this write.
  if ((data ?? []).length === 0) return "Couldn't redeem that promo code. Please try again.";
  return null;
}

/**
 * Starts a PayMongo hosted checkout for any paid tier + billing period.
 * The charged amount always matches what the UI shows, and a genuine active
 * annual promo is applied server-side so the promo price is what's billed.
 */
export async function startCheckout(
  plan: PaidPlan,
  period: BillingPeriod,
): Promise<CheckoutResult> {
  if (!paymongoConfigured()) {
    return { ok: false, error: "Billing isn't set up yet. Try again soon." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  // Decided from the server-resolved entitlement, never the client: the
  // webhook activates by overwriting the one subscriptions row, so a Lifetime
  // or live complimentary grant would be replaced by a dated paid period.
  const blocked = checkoutBlockReason(await getEntitlement(), "subscription", plan);
  if (blocked) return { ok: false, error: blocked };

  let amount = PLAN_PRICES[plan][period].total;
  // Honor a genuine, still-active annual promo (charged price = shown price).
  if (period === "annual") {
    const offer = await getActiveOffer();
    if (offer) amount = PROMO.offers[plan].promo;
  }

  const reference = buildSubscriptionReference(user.id, plan, period, Date.now());
  const site = getSiteURL();
  const planName = plan === "premium" ? "Premium" : "Pro";

  return createPaymongoCheckout({
    reference,
    kind: "subscription",
    amountPHP: amount,
    name: `Finance & Habit Tracker ${planName}`,
    description: `${planName} — ${PERIOD_LABEL[period]}`,
    email: user.email ?? null,
    successUrl: `${site}/settings?upgraded=1`,
    cancelUrl: `${site}/settings?checkout=failed`,
  });
}

/**
 * Redeem an admin-created promo code. Free promos activate immediately. Paid
 * promos create a one-off PayMongo checkout and only activate from the webhook.
 * Nothing here stores a card or authorizes a later automatic charge.
 */
export async function redeemPromoCode(
  rawCode: string,
): Promise<PromoCheckoutResult> {
  const code = cleanPromoCode(rawCode);
  if (!code) return { ok: false, error: "Enter a promo code." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  // A promo activates by overwriting the subscriptions row with its own
  // period, so redeeming one on top of live access would cut that access short.
  const blocked = checkoutBlockReason(await getEntitlement(), "promo");
  if (blocked) return { ok: false, error: blocked };

  const admin = createAdminClient();

  // Throttled before the code is looked up, so codes can't be guessed at speed.
  // The attempt is recorded first and counted second (see promoAttemptBlocked);
  // a refused one is removed again, so hammering past the limit can't push the
  // cross-account ceiling up for everyone else.
  const { data: attempt, error: attemptError } = await admin
    .from("promo_redeem_attempts")
    .insert({ user_id: user.id })
    .select("id")
    .single<{ id: number }>();
  if (attemptError || !attempt) {
    return {
      ok: false,
      error: isSchemaMissing(attemptError)
        ? migrationRequired("Promo codes", "0029")
        : "Couldn't check that promo code. Please try again.",
    };
  }
  const now = Date.now();
  const [mine, guesses] = await Promise.all([
    admin
      .from("promo_redeem_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("attempted_at", new Date(now - PROMO_USER_WINDOW_MS).toISOString()),
    admin
      .from("promo_redeem_attempts")
      .select("id", { count: "exact", head: true })
      .eq("valid_code", false)
      .gte("attempted_at", new Date(now - PROMO_GLOBAL_WINDOW_MS).toISOString()),
  ]);
  const throttled =
    mine.error || guesses.error
      ? "Couldn't check that promo code. Please try again."
      : promoAttemptBlocked(mine.count ?? 0, guesses.count ?? 0);
  if (throttled) {
    await admin.from("promo_redeem_attempts").delete().eq("id", attempt.id);
    return { ok: false, error: throttled };
  }

  const { data: promo, error } = await admin
    .from("promo_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle<{
      id: string;
      code: string;
      plan: "pro" | "premium";
      duration_months: number;
      max_redemptions: number | null;
      expires_at: string | null;
      active: boolean;
      special_price: number | null;
    }>();
  // One answer for missing, paused and expired codes: separate messages told a
  // guesser which codes were real.
  if (error || !isRedeemable(promo, Date.now())) {
    return { ok: false, error: INVALID_PROMO_MESSAGE };
  }
  // Not a guess, so it stays out of the cross-account ceiling.
  await admin.from("promo_redeem_attempts").update({ valid_code: true }).eq("id", attempt.id);

  // An unpaid checkout holds its slot for a day, then is released: marked
  // expired, not deleted, so a late payment still finds its row and is
  // recorded for a refund (activatePromo in the PayMongo webhook).
  await admin
    .from("promo_redemptions")
    .update({ status: "expired" })
    .eq("promo_code_id", promo.id)
    .eq("status", "pending")
    .lt("updated_at", pendingCutoffIso(Date.now()));

  const { data: own } = await admin
    .from("promo_redemptions")
    .select("id, status, invoice_external_id")
    .eq("promo_code_id", promo.id)
    .eq("user_id", user.id)
    .maybeSingle<{
      id: string;
      status: PromoRedemption["status"];
      invoice_external_id: string | null;
    }>();
  const action = ownRedemptionAction(own);
  if (action === "used") {
    return { ok: false, error: "You've already used this promo code." };
  }
  const resumed = action === "resume" ? own : null;

  // A fast pre-check only: the database enforces the cap under a lock (0029).
  // The caller's own still-pending row already holds its slot.
  if (promo.max_redemptions !== null && resumed?.status !== "pending") {
    const { count } = await admin
      .from("promo_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promo_code_id", promo.id)
      .in("status", ["active", "pending"]);
    if ((count ?? 0) >= promo.max_redemptions) {
      return { ok: false, error: "That promo code has reached its limit." };
    }
  }

  const amount = Math.max(0, Number(promo.special_price ?? 0));
  const startsAt = new Date().toISOString();
  const expiresAt = addMonthsIso(promo.duration_months);

  if (amount === 0) {
    const redeemError = await writeRedemption(admin, promo.id, user.id, resumed, {
      status: "active",
      amount_paid: 0,
      redeemed_at: startsAt,
      access_starts_at: startsAt,
      access_expires_at: expiresAt,
    });
    if (redeemError) return { ok: false, error: redeemError };

    const { error: subError } = await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan: promo.plan,
        status: "active",
        interval: `promo_${promo.duration_months}m`,
        billing_period: `promo_${promo.duration_months}m`,
        current_period_start: startsAt,
        current_period_end: expiresAt,
        access_type: "promo",
        access_expires_at: expiresAt,
        amount_paid: 0,
        promo_code_id: promo.id,
        promo_code: promo.code,
        cancel_at_period_end: true,
      },
      { onConflict: "user_id" },
    );
    if (subError) {
      // The redemption is already recorded as used, so a retry would be refused.
      console.error("[promo] subscription write failed", subError.code);
      return {
        ok: false,
        error: "Your promo code was redeemed, but we couldn't apply it. Contact support.",
      };
    }

    return {
      ok: true,
      free: true,
      message: `${promo.plan === "premium" ? "Premium" : "Pro"} promo activated for ${promo.duration_months} month${promo.duration_months === 1 ? "" : "s"}.`,
    };
  }

  if (!paymongoConfigured()) {
    return { ok: false, error: "Billing isn't set up yet. Try again soon." };
  }

  // A resumed checkout keeps its reference: the webhook finds the row by it, so
  // a late payment on the earlier session still lands (or, if both sessions
  // get paid, the second is caught as a conflict and recorded for a refund).
  const reference =
    resumed?.invoice_external_id ?? buildPromoReference(user.id, promo.id, Date.now());
  const pendingError = await writeRedemption(admin, promo.id, user.id, resumed, {
    status: "pending",
    amount_paid: amount,
    invoice_external_id: reference,
  });
  if (pendingError) return { ok: false, error: pendingError };

  const site = getSiteURL();
  const tierName = promo.plan === "premium" ? "Premium" : "Pro";
  const months = `${promo.duration_months} month${promo.duration_months === 1 ? "" : "s"}`;
  const res = await createPaymongoCheckout({
    reference,
    kind: "promo",
    amountPHP: amount,
    name: `Finance & Habit Tracker ${tierName} promo`,
    description: `${tierName} — ${months}`,
    email: user.email ?? null,
    successUrl: `${site}/settings?upgraded=promo`,
    cancelUrl: `${site}/settings?checkout=failed`,
  });
  if (!res.ok) {
    // Release the slot so a failed start never holds the code or its cap. A
    // resumed row that was still pending keeps its hold: its earlier session
    // can still be paid.
    if (!resumed) {
      await admin.from("promo_redemptions").delete().eq("invoice_external_id", reference);
    } else if (resumed.status === "expired") {
      await admin
        .from("promo_redemptions")
        .update({ status: "expired" })
        .eq("id", resumed.id)
        .eq("status", "pending");
    }
    return res;
  }
  return { ok: true, free: false, url: res.url };
}

/**
 * Founding Lifetime checkout: a one-time invoice for permanent Premium access.
 *
 * Everything that matters is decided HERE, on the server, never from the
 * client: the offer must genuinely still be available (re-resolved from config
 * + the real purchase count), the price is read from the config (not sent by
 * the browser), and the user must not already own Lifetime. The invoice is
 * tagged `_lifetime_` so the webhook grants access_type='lifetime_pro' with no
 * period end, and so getLifetimeSold() can count it.
 *
 * Charged in pesos: PayMongo Checkout Sessions settle in PHP only, so the price
 * is LIFETIME_OFFER's peso launch/regular price, re-read here on the server.
 */
export async function startLifetimeCheckout(): Promise<CheckoutResult> {
  if (!paymongoConfigured()) {
    return { ok: false, error: "Billing isn't set up yet. Try again soon." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  // Already own it — nothing to sell. A paid subscriber or a complimentary
  // holder CAN convert to Lifetime (it only ever adds access); an existing
  // Lifetime holder or a super admin is refused.
  const blocked = checkoutBlockReason(await getEntitlement(), "lifetime");
  if (blocked) return { ok: false, error: blocked };

  // Re-check availability server-side; a sold-out or disabled offer must not be
  // purchasable no matter what the page showed.
  const offer = await resolveLifetimeOffer();
  if (!offer.available) {
    return {
      ok: false,
      error: offer.soldOut
        ? "The founding lifetime offer has sold out."
        : "The lifetime offer isn't available right now.",
    };
  }

  const reference = buildLifetimeReference(user.id, LIFETIME_OFFER.plan, Date.now());
  const site = getSiteURL();

  return createPaymongoCheckout({
    reference,
    kind: "lifetime",
    amountPHP: offer.pricePHP,
    name: "Finance & Habit Tracker — Premium Lifetime",
    description: "One-time payment. Never billed again.",
    email: user.email ?? null,
    successUrl: `${site}/settings?upgraded=lifetime`,
    cancelUrl: `${site}/settings?checkout=failed`,
  });
}
