import { NextResponse, type NextRequest } from "next/server";
import { addMonths, addYears } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Xendit invoice webhook. Configure the callback URL in the Xendit dashboard to
 * point here, with a verification token that matches XENDIT_WEBHOOK_TOKEN.
 * On a PAID subscription invoice, activates the user's Pro subscription.
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get("x-callback-token");
  if (!token || token !== process.env.XENDIT_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { status?: string; external_id?: string; id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const externalId = body.external_id ?? "";
  if (body.status === "PAID" && externalId.startsWith("sub_")) {
    // sub_<uuid>_<interval>_<timestamp> — the UUID has no underscores.
    const parts = externalId.split("_");
    const userId = parts[1];
    const interval = parts[2] === "yearly" ? "yearly" : "monthly";
    const now = new Date();
    const periodEnd =
      interval === "yearly" ? addYears(now, 1) : addMonths(now, 1);

    try {
      const admin = createAdminClient();
      await admin.from("subscriptions").upsert(
        {
          user_id: userId,
          plan: "pro",
          status: "active",
          interval,
          xendit_customer_id: body.id ?? null,
          current_period_end: periodEnd.toISOString(),
        },
        { onConflict: "user_id" },
      );
    } catch {
      // If the admin client isn't configured yet, acknowledge so Xendit doesn't
      // retry forever; the payment is recorded on Xendit's side regardless.
      return NextResponse.json({ received: true, stored: false });
    }
  }

  return NextResponse.json({ received: true });
}
