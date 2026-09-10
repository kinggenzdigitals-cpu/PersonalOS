import { NextResponse, type NextRequest } from "next/server";
import { addMonths } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSchemaMissing } from "@/lib/supabase/errors";
import { timingSafeEqual } from "node:crypto";

/**
 * Xendit invoice webhook. Configure the callback URL in the Xendit dashboard to
 * point here, with a verification token that matches XENDIT_WEBHOOK_TOKEN.
 * On a PAID subscription invoice, activates the user's subscription.
 *
 * Server-authoritative: a subscription is only ever marked paid from here, and
 * never from a frontend redirect. Deliveries are idempotent — Xendit retries,
 * and replaying a PAID callback must not extend the paid period again.
 */

/** Constant-time token comparison (avoids leaking the token via timing). */
function tokenMatches(received: string | null): boolean {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type Interval = "monthly" | "quarterly" | "semiannual" | "annual" | "yearly";

const MONTHS: Record<Interval, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
  yearly: 12,
};

export async function POST(request: NextRequest) {
  if (!tokenMatches(request.headers.get("x-callback-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    status?: string;
    external_id?: string;
    id?: string;
    amount?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const externalId = body.external_id ?? "";
  const status = body.status ?? "";
  if (!externalId.startsWith("sub_")) {
    return NextResponse.json({ received: true });
  }

  // New: sub_<uuid>_<plan>_<period>_<ts>. Old: sub_<uuid>_<interval>_<ts>.
  // The UUID has no underscores, so positions are stable.
  const parts = externalId.split("_");
  const userId = parts[1];

  let plan: "pro" | "premium" = "pro";
  let interval: Interval = "monthly";
  // A lifetime invoice: sub_<uuid>_<plan>_lifetime_<ts>. Handled separately
  // below — it grants a permanent entitlement with no period to extend.
  const isLifetime = parts.length >= 5 && parts[3] === "lifetime";
  if (parts.length >= 5) {
    plan = parts[2] === "premium" ? "premium" : "pro";
    interval = (parts[3] as Interval) in MONTHS ? (parts[3] as Interval) : "monthly";
  } else {
    interval = parts[2] === "yearly" ? "yearly" : "monthly";
  }
  const months = MONTHS[interval];

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    // Admin client isn't configured — acknowledge so Xendit doesn't retry
    // forever; the payment is recorded on Xendit's side regardless.
    return NextResponse.json({ received: true, stored: false });
  }

  // Only a PAID invoice grants access. Other states are recorded for audit but
  // never applied; expiry is evaluated from current_period_end.
  const eventId = body.id ?? externalId;
  const eventRow = {
    provider: "xendit",
    event_id: eventId,
    external_id: externalId,
    user_id: userId,
    status,
    amount: typeof body.amount === "number" ? body.amount : null,
  };

  if (status !== "PAID") {
    await admin.from("billing_events").insert(eventRow);
    return NextResponse.json({ received: true, applied: false });
  }

  // Idempotency: claim the (invoice, status) key first. A duplicate PAID
  // delivery collides and stops here, so a retry can never extend the period
  // a second time. The key includes `status`, so an earlier PENDING/EXPIRED
  // callback for the same invoice does not block the PAID one.
  const { error: claimError } = await admin
    .from("billing_events")
    .insert(eventRow);

  let claimed = false;
  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Table not migrated yet → proceed without idempotency rather than
    // dropping a real payment on the floor.
    if (!isSchemaMissing(claimError)) {
      return NextResponse.json(
        { received: false, error: "event log failed" },
        { status: 500 },
      );
    }
  } else {
    claimed = true;
  }

  /** Release the idempotency claim so Xendit's retry can try again. */
  async function releaseClaim() {
    if (!claimed) return;
    await admin
      .from("billing_events")
      .delete()
      .eq("provider", "xendit")
      .eq("event_id", eventId)
      .eq("status", status);
  }

  try {
    // Renewals extend from whatever time is left, not from now, so paying
    // early never forfeits the remainder of the current period.
    const { data: existing } = await admin
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", userId)
      .maybeSingle<{ current_period_end: string | null }>();

    const now = new Date();
    const currentEnd = existing?.current_period_end
      ? new Date(existing.current_period_end)
      : null;
    const base =
      currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;

    // supabase-js does NOT throw on query errors — the result must be checked,
    // or a failed activation would be acknowledged as success and the user
    // would have paid for nothing. Two separate upserts rather than one shared
    // object: access_type differs by a string-literal type between the
    // branches, so each literal must be checked against the Insert shape on its
    // own (a union of the two is not assignable to upsert's parameter).
    const { error: subError } = isLifetime
      ? await admin.from("subscriptions").upsert(
          {
            user_id: userId,
            plan,
            status: "active",
            interval: "lifetime",
            // Permanent: null period → entitlement reads a lifetime grant as forever.
            access_type: "lifetime_pro",
            xendit_customer_id: body.id ?? null,
            current_period_end: null,
          },
          { onConflict: "user_id" },
        )
      : await admin.from("subscriptions").upsert(
          {
            user_id: userId,
            plan,
            status: "active",
            interval,
            access_type: "paid",
            xendit_customer_id: body.id ?? null,
            // Extend from whatever time is left, never from now.
            current_period_end: addMonths(base, months).toISOString(),
          },
          { onConflict: "user_id" },
        );

    if (subError) {
      console.error("[xendit] subscription activation failed", subError.code);
      await releaseClaim();
      return NextResponse.json(
        { received: false, error: "activation failed" },
        { status: 500 },
      );
    }

    // Paying again is an explicit renewal, so clear any pending "don't renew".
    // Separate from the activation upsert on purpose: these columns arrive with
    // migration 0017, and a missing column must never fail a real payment.
    const { error: renewError } = await admin
      .from("subscriptions")
      .update({ cancel_at_period_end: false, canceled_at: null })
      .eq("user_id", userId);
    if (renewError && !isSchemaMissing(renewError)) {
      console.error("[xendit] clearing cancellation failed", renewError.code);
    }

    // A completed paid subscription consumes any active promo offer.
    await admin
      .from("promotion_offers")
      .update({ status: "redeemed" })
      .eq("user_id", userId)
      .eq("status", "active");
  } catch {
    await releaseClaim();
    return NextResponse.json(
      { received: false, error: "activation failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
