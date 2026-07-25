"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteURL } from "@/lib/site";
import { PLANS } from "@/lib/plans";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Starts a Xendit hosted-invoice checkout for Pro. Returns the invoice URL to
 * redirect the user to (they pay with GCash / Maya / card / bank). On success,
 * Xendit calls our webhook which activates the subscription.
 */
export async function startProCheckout(
  interval: "monthly" | "yearly",
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

  const amount =
    interval === "yearly" ? PLANS.pro.priceYearly : PLANS.pro.priceMonthly;
  const externalId = `sub_${user.id}_${interval}_${Date.now()}`;
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
        amount,
        currency: "PHP",
        payer_email: user.email,
        description: `Life OS Pro — ${interval === "yearly" ? "Yearly" : "Monthly"}`,
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
