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
  if (error || !promo) return { ok: false, error: "Promo code not found." };
  if (!promo.active) return { ok: false, error: "That promo is no longer active." };
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "That promo code has expired." };
  }

  const { data: existingRedemption } = await admin
    .from("promo_redemptions")
    .select("id, status")
    .eq("promo_code_id", promo.id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; status: string }>();
  if (existingRedemption?.status === "active") {
    return { ok: false, error: "You've already used this promo code." };
  }
  if (existingRedemption?.status === "pending") {
    return { ok: false, error: "This promo checkout is already pending." };
  }
  if (existingRedemption) {
    return { ok: false, error: "You've already used this promo code." };
  }

  if (promo.max_redemptions !== null) {
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
    const { error: redeemError } = await admin.from("promo_redemptions").insert({
      promo_code_id: promo.id,
      user_id: user.id,
      status: "active",
      amount_paid: 0,
      redeemed_at: startsAt,
      access_starts_at: startsAt,
      access_expires_at: expiresAt,
    });
    if (redeemError) return { ok: false, error: redeemError.message };

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
    if (subError) return { ok: false, error: subError.message };

    return {
      ok: true,
      free: true,
      message: `${promo.plan === "premium" ? "Premium" : "Pro"} promo activated for ${promo.duration_months} month${promo.duration_months === 1 ? "" : "s"}.`,
    };
  }

  if (!paymongoConfigured()) {
    return { ok: false, error: "Billing isn't set up yet. Try again soon." };
  }

  const reference = buildPromoReference(user.id, promo.id, Date.now());
  const { error: pendingError } = await admin.from("promo_redemptions").insert({
    promo_code_id: promo.id,
    user_id: user.id,
    status: "pending",
    amount_paid: amount,
    invoice_external_id: reference,
  });
  if (pendingError) return { ok: false, error: pendingError.message };

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
    // Release the slot so a failed start never holds the code or its cap.
    await admin.from("promo_redemptions").delete().eq("invoice_external_id", reference);
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
