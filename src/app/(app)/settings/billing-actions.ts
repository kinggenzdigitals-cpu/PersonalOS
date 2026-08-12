"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteURL } from "@/lib/site";
import { PLAN_PRICES, type BillingPeriod } from "@/lib/plans";
import { getActiveOffer } from "@/lib/promo";
import { PROMO } from "@/lib/promo-config";

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
