"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteURL } from "@/lib/site";
import { type BillingPeriod } from "@/lib/plans";
import { getActiveOffer } from "@/lib/promo";
import { PROMO } from "@/lib/promo-config";
import {
  checkoutAmount,
  isBillingPeriod,
  isPaidPlan,
  periodMonths,
  type PaidPlan,
} from "@/lib/billing-security";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

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
  if (!isPaidPlan(plan) || !isBillingPeriod(period)) {
    return { ok: false, error: "Choose a valid plan and billing period." };
  }

  const secret = process.env.XENDIT_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: "Billing isn't set up yet. Try again soon." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  let amount = checkoutAmount(plan, period);
  let promotionOfferId: string | null = null;
  // Honor a genuine, still-active annual promo (charged price = shown price).
  if (period === "annual") {
    const offer = await getActiveOffer();
    if (offer) {
      amount = PROMO.offers[plan].promo;
      promotionOfferId = offer.id;
    }
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Billing isn't set up yet. Try again soon." };
  }

  const externalId = `fht_${globalThis.crypto.randomUUID()}`;
  const site = getSiteURL();
  const planName = plan === "premium" ? "Premium" : "Pro";

  const { error: checkoutError } = await admin
    .from("payment_checkout_sessions")
    .insert({
      external_id: externalId,
      user_id: user.id,
      plan,
      billing_period: period,
      period_months: periodMonths(period),
      expected_amount: amount,
      currency: "PHP",
      promotion_offer_id: promotionOfferId,
    });
  if (checkoutError) {
    return { ok: false, error: "Couldn't prepare checkout. Please try again." };
  }

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
        description: `Finance & Habit Tracker ${planName} - ${PERIOD_LABEL[period]}`,
        success_redirect_url: `${site}/settings?upgraded=1`,
        failure_redirect_url: `${site}/settings?checkout=failed`,
      }),
    });

    if (!res.ok) {
      await admin
        .from("payment_checkout_sessions")
        .update({ status: "failed" })
        .eq("external_id", externalId);
      return { ok: false, error: "Couldn't start checkout. Please try again." };
    }
    const data = (await res.json()) as { id?: string; invoice_url?: string };
    if (!data.invoice_url) {
      await admin
        .from("payment_checkout_sessions")
        .update({ status: "failed" })
        .eq("external_id", externalId);
      return { ok: false, error: "Couldn't start checkout. Please try again." };
    }

    await admin
      .from("payment_checkout_sessions")
      .update({
        provider_invoice_id: data.id ?? null,
        provider_invoice_url: data.invoice_url,
      })
      .eq("external_id", externalId);
    return { ok: true, url: data.invoice_url };
  } catch {
    await admin
      .from("payment_checkout_sessions")
      .update({ status: "failed" })
      .eq("external_id", externalId);
    return { ok: false, error: "Couldn't reach the payment provider." };
  }
}
