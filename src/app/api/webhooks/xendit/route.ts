import { NextResponse, type NextRequest } from "next/server";
import { addMonths } from "date-fns";
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
    // New: sub_<uuid>_<plan>_<period>_<ts>. Old: sub_<uuid>_<interval>_<ts>.
    // The UUID has no underscores, so positions are stable.
    const parts = externalId.split("_");
    const userId = parts[1];

    let plan: "pro" | "premium" = "pro";
    let interval = "monthly";
    let months = 1;
    if (parts.length >= 5) {
      plan = parts[2] === "premium" ? "premium" : "pro";
      interval = parts[3];
      months =
        interval === "annual"
          ? 12
          : interval === "semiannual"
            ? 6
            : interval === "quarterly"
              ? 3
              : 1;
    } else {
      interval = parts[2] === "yearly" ? "yearly" : "monthly";
      months = interval === "yearly" ? 12 : 1;
    }

    const now = new Date();
    const periodEnd = addMonths(now, months);

    try {
      const admin = createAdminClient();
      await admin.from("subscriptions").upsert(
        {
          user_id: userId,
          plan,
          status: "active",
          interval,
          access_type: "paid",
          xendit_customer_id: body.id ?? null,
          current_period_end: periodEnd.toISOString(),
        },
        { onConflict: "user_id" },
      );
      // A completed paid subscription consumes any active promo offer.
      await admin
        .from("promotion_offers")
        .update({ status: "redeemed" })
        .eq("user_id", userId)
        .eq("status", "active");
    } catch {
      // If the admin client isn't configured yet, acknowledge so Xendit doesn't
      // retry forever; the payment is recorded on Xendit's side regardless.
      return NextResponse.json({ received: true, stored: false });
    }
  }

  return NextResponse.json({ received: true });
}
