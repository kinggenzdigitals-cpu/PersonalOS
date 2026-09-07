import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePaidCallback } from "@/lib/billing-security";

/**
 * Xendit invoice webhook. Configure the callback URL in the Xendit dashboard to
 * point here, with a verification token that matches XENDIT_WEBHOOK_TOKEN.
 * On a verified PAID invoice, atomically activates the exact checkout stored
 * before the user was sent to Xendit. Duplicate callbacks are safe.
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get("x-callback-token");
  if (!token || token !== process.env.XENDIT_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const row = body as Record<string, unknown> | null;
  if (row?.status !== "PAID") {
    return NextResponse.json({ received: true });
  }

  const paid = parsePaidCallback(body);
  if (!paid) {
    return NextResponse.json({ error: "invalid payment" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("complete_payment_checkout", {
      p_external_id: paid.externalId,
      p_provider_invoice_id: paid.invoiceId,
      p_paid_amount: paid.amount,
      p_currency: paid.currency,
      ...(paid.paidAt ? { p_paid_at: paid.paidAt } : {}),
    });
    if (error) {
      return NextResponse.json({ error: "payment not stored" }, { status: 500 });
    }
    return NextResponse.json({ received: true, result: data });
  } catch {
    return NextResponse.json({ error: "payment not stored" }, { status: 500 });
  }

}
