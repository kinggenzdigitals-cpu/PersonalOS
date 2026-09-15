import "server-only";

/**
 * PayMongo checkout adapter. Server-only: it holds the secret key, and the
 * amount it charges is always computed by the calling server action, never
 * taken from the browser.
 *
 * Uses Checkout Sessions (v2, "recommended for new integrations"): a hosted
 * page offering GCash, Maya, GrabPay, ShopeePay and cards. Checkout Sessions
 * settle in PHP only, which is why every price in this app is in pesos.
 * Nothing is stored for later — each period is a separate one-off payment.
 */

const CHECKOUT_SESSIONS_URL = "https://api.paymongo.com/v2/checkout_sessions";

/** Values as documented for payment_method_types (cards + e-wallets). */
const PAYMENT_METHOD_TYPES = ["card", "gcash", "paymaya", "grab_pay", "shopeepay"];

export type PaymongoCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function paymongoConfigured(): boolean {
  return Boolean(process.env.PAYMONGO_SECRET_KEY);
}

/**
 * True when the configured secret key is a LIVE key. Decides which half of the
 * webhook signature is valid (li vs te) and which events may activate access,
 * so a test-mode payment can never grant anything on a live deployment.
 */
export function paymongoLiveMode(): boolean {
  return (process.env.PAYMONGO_SECRET_KEY ?? "").startsWith("sk_live_");
}

export async function createPaymongoCheckout(input: {
  /** From lib/billing-reference — the webhook activates from this alone. */
  reference: string;
  kind: "subscription" | "promo" | "lifetime";
  amountPHP: number;
  name: string;
  description: string;
  email: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<PaymongoCheckoutResult> {
  const secret = process.env.PAYMONGO_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: "Billing isn't set up yet. Try again soon." };
  }

  const amountCentavos = Math.round(input.amountPHP * 100);
  if (!Number.isSafeInteger(amountCentavos) || amountCentavos <= 0) {
    return { ok: false, error: "Couldn't start checkout. Please try again." };
  }

  try {
    const res = await fetch(CHECKOUT_SESSIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: input.name,
                description: input.description,
                amount: amountCentavos,
                currency: "PHP",
                quantity: 1,
              },
            ],
            payment_method_types: PAYMENT_METHOD_TYPES,
            reference_number: input.reference,
            description: input.description,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            send_email_receipt: true,
            show_line_items: true,
            ...(input.email ? { customer_email: input.email } : {}),
            // Comes back inside the signed webhook event. The webhook refuses
            // to activate unless what was actually paid equals this, so a
            // partial or altered payment can never grant access.
            metadata: {
              kind: input.kind,
              expected_centavos: String(amountCentavos),
            },
          },
        },
      }),
    });

    if (!res.ok) {
      return { ok: false, error: "Couldn't start checkout. Please try again." };
    }
    const json = (await res.json()) as {
      data?: { attributes?: { checkout_url?: string } };
    };
    const url = json.data?.attributes?.checkout_url;
    if (!url || !url.startsWith("https://")) {
      return { ok: false, error: "Couldn't start checkout. Please try again." };
    }
    return { ok: true, url };
  } catch {
    return { ok: false, error: "Couldn't reach the payment provider." };
  }
}
