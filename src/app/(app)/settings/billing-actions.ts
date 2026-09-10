"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteURL } from "@/lib/site";
import { PLAN_PRICES, type BillingPeriod } from "@/lib/plans";
import { getActiveOffer } from "@/lib/promo";
import { PROMO } from "@/lib/promo-config";
import { LIFETIME_OFFER } from "@/lib/offer-config";
import { resolveLifetimeOffer } from "@/lib/offer";
import { getEntitlement } from "@/lib/entitlement";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

type PaidPlan = "pro" | "premium";

const PERIOD_LABEL: Record<BillingPeriod, string> = {
  monthly: "Monthly",
  quarterly: "3 months",
  semiannual: "6 months",
  annual: "1 year",
};

/**
 * Starts a Xendit hosted-invoice checkout for any paid tier + billing period.
 * The charged amount always matches what the UI shows, and a genuine active
 * annual promo is applied server-side so the promo price is what's billed.
 */
export async function startCheckout(
  plan: PaidPlan,
  period: BillingPeriod,
): Promise<CheckoutResult> {
  const secret = process.env.XENDIT_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: "Billing isn't set up yet. Try again soon." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  let amount = PLAN_PRICES[plan][period].total;
  // Honor a genuine, still-active annual promo (charged price = shown price).
  if (period === "annual") {
    const offer = await getActiveOffer();
    if (offer) amount = PROMO.offers[plan].promo;
  }

  const externalId = `sub_${user.id}_${plan}_${period}_${Date.now()}`;
  const site = getSiteURL();
  const planName = plan === "premium" ? "Premium" : "Pro";

  try {
    const res = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: externalId,
        amount,
        currency: "PHP",
        payer_email: user.email,
        description: `Finance & Habit Tracker ${planName} — ${PERIOD_LABEL[period]}`,
        success_redirect_url: `${site}/settings?upgraded=1`,
        failure_redirect_url: `${site}/settings?checkout=failed`,
      }),
    });

    if (!res.ok) {
      return { ok: false, error: "Couldn't start checkout. Please try again." };
    }
    const data = (await res.json()) as { invoice_url?: string };
    if (!data.invoice_url) {
      return { ok: false, error: "Couldn't start checkout. Please try again." };
    }
    return { ok: true, url: data.invoice_url };
  } catch {
    return { ok: false, error: "Couldn't reach the payment provider." };
  }
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
 * Currency is USD (§13). Whether Xendit can settle USD is a merchant setting:
 * the invoice is created in the configured currency, and if the account is not
 * USD-enabled Xendit rejects it and the user sees a clear failure — we never
 * silently charge a mismatched amount in another currency.
 */
export async function startLifetimeCheckout(): Promise<CheckoutResult> {
  const secret = process.env.XENDIT_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: "Billing isn't set up yet. Try again soon." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  // Already own it — nothing to sell. (A paid subscriber CAN convert to
  // Lifetime; only an existing Lifetime/comp holder is refused here.)
  const ent = await getEntitlement();
  if (ent.accessType === "lifetime_pro" || ent.isSuperAdmin) {
    return { ok: false, error: "You already have lifetime access." };
  }

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

  const externalId = `sub_${user.id}_${LIFETIME_OFFER.plan}_lifetime_${Date.now()}`;
  const site = getSiteURL();

  try {
    const res = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: externalId,
        amount: offer.priceUSD,
        currency: LIFETIME_OFFER.currency,
        payer_email: user.email,
        description: "Finance & Habit Tracker — Premium Lifetime (one-time)",
        success_redirect_url: `${site}/settings?upgraded=lifetime`,
        failure_redirect_url: `${site}/settings?checkout=failed`,
      }),
    });

    if (!res.ok) {
      // The most common real cause is the merchant account not being enabled
      // for the configured currency — surface it plainly rather than pretend.
      return {
        ok: false,
        error:
          "Couldn't start lifetime checkout. International checkout may not be enabled yet.",
      };
    }
    const data = (await res.json()) as { invoice_url?: string };
    if (!data.invoice_url) {
      return { ok: false, error: "Couldn't start checkout. Please try again." };
    }
    return { ok: true, url: data.invoice_url };
  } catch {
    return { ok: false, error: "Couldn't reach the payment provider." };
  }
}
