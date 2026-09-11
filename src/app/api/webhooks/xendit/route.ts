import { NextResponse, type NextRequest } from "next/server";
import { addMonths } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSchemaMissing } from "@/lib/supabase/errors";
import { timingSafeEqual } from "node:crypto";

/**
 * Xendit invoice webhook. Configure the callback URL in the Xendit dashboard to
 * point here, with a verification token that matches XENDIT_WEBHOOK_TOKEN.
 * On a PAID invoice, activates the user's subscription or promo access.
 */
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

type Admin = ReturnType<typeof createAdminClient>;

async function claimPaidEvent(
  admin: Admin,
  eventRow: {
    provider: string;
    event_id: string;
    external_id: string;
    user_id: string | null;
    status: string;
    amount: number | null;
  },
) {
  const { error } = await admin.from("billing_events").insert(eventRow);
  if (!error) return { claimed: true as const };
  if (error.code === "23505") return { duplicate: true as const };
  if (isSchemaMissing(error)) return { claimed: false as const };
  return { error: true as const };
}

async function releaseClaim(
  admin: Admin,
  claimed: boolean,
  eventId: string,
  status: string,
) {
  if (!claimed) return;
  await admin
    .from("billing_events")
    .delete()
    .eq("provider", "xendit")
    .eq("event_id", eventId)
    .eq("status", status);
}

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
  if (!externalId.startsWith("sub_") && !externalId.startsWith("promo_")) {
    return NextResponse.json({ received: true });
  }

  const parts = externalId.split("_");
  const userId = parts[1] ?? null;

  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ received: true, stored: false });
  }

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

  const claim = await claimPaidEvent(admin, eventRow);
  if ("duplicate" in claim) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if ("error" in claim) {
    return NextResponse.json(
      { received: false, error: "event log failed" },
      { status: 500 },
    );
  }
  const claimed = claim.claimed;

  if (externalId.startsWith("promo_")) {
    try {
      const { data: redemption, error: redemptionError } = await admin
        .from("promo_redemptions")
        .select("*")
        .eq("invoice_external_id", externalId)
        .maybeSingle<{
          id: string;
          promo_code_id: string;
          user_id: string;
          status: "pending" | "active" | "expired" | "canceled";
        }>();

      if (redemptionError || !redemption || redemption.status !== "pending") {
        await releaseClaim(admin, claimed, eventId, status);
        return NextResponse.json(
          { received: false, error: "promo redemption not found" },
          { status: 500 },
        );
      }

      const { data: promo, error: promoError } = await admin
        .from("promo_codes")
        .select("id, code, plan, duration_months, special_price")
        .eq("id", redemption.promo_code_id)
        .maybeSingle<{
          id: string;
          code: string;
          plan: "pro" | "premium";
          duration_months: number;
          special_price: number | null;
        }>();

      if (promoError || !promo) {
        await releaseClaim(admin, claimed, eventId, status);
        return NextResponse.json(
          { received: false, error: "promo code not found" },
          { status: 500 },
        );
      }

      const startsAt = new Date();
      const expiresAt = addMonths(startsAt, promo.duration_months);
      const amountPaid = typeof body.amount === "number" ? body.amount : promo.special_price;

      const { error: redeemError } = await admin
        .from("promo_redemptions")
        .update({
          status: "active",
          amount_paid: amountPaid ?? 0,
          redeemed_at: startsAt.toISOString(),
          access_starts_at: startsAt.toISOString(),
          access_expires_at: expiresAt.toISOString(),
        })
        .eq("id", redemption.id)
        .eq("status", "pending");

      if (redeemError) {
        await releaseClaim(admin, claimed, eventId, status);
        return NextResponse.json(
          { received: false, error: "promo activation failed" },
          { status: 500 },
        );
      }

      const { error: subError } = await admin.from("subscriptions").upsert(
        {
          user_id: redemption.user_id,
          plan: promo.plan,
          status: "active",
          interval: `promo_${promo.duration_months}m`,
          billing_period: `promo_${promo.duration_months}m`,
          access_type: "promo",
          access_expires_at: expiresAt.toISOString(),
          xendit_customer_id: body.id ?? null,
          current_period_start: startsAt.toISOString(),
          current_period_end: expiresAt.toISOString(),
          amount_paid: amountPaid ?? 0,
          promo_code_id: promo.id,
          promo_code: promo.code,
          cancel_at_period_end: true,
          canceled_at: null,
        },
        { onConflict: "user_id" },
      );

      if (subError) {
        await releaseClaim(admin, claimed, eventId, status);
        return NextResponse.json(
          { received: false, error: "promo subscription failed" },
          { status: 500 },
        );
      }
    } catch {
      await releaseClaim(admin, claimed, eventId, status);
      return NextResponse.json(
        { received: false, error: "promo activation failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ received: true });
  }

  const isLifetime = parts.length >= 5 && parts[3] === "lifetime";
  let plan: "pro" | "premium" = "pro";
  let interval: Interval = "monthly";
  if (parts.length >= 5) {
    plan = parts[2] === "premium" ? "premium" : "pro";
    interval = (parts[3] as Interval) in MONTHS ? (parts[3] as Interval) : "monthly";
  } else {
    interval = parts[2] === "yearly" ? "yearly" : "monthly";
  }
  const months = MONTHS[interval];

  try {
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
    const periodEnd = addMonths(base, months).toISOString();

    const { error: subError } = isLifetime
      ? await admin.from("subscriptions").upsert(
          {
            user_id: userId!,
            plan,
            status: "active",
            interval: "lifetime",
            billing_period: "lifetime",
            access_type: "lifetime_pro",
            access_expires_at: null,
            xendit_customer_id: body.id ?? null,
            current_period_start: now.toISOString(),
            current_period_end: null,
            amount_paid: typeof body.amount === "number" ? body.amount : null,
            promo_code_id: null,
            promo_code: null,
            cancel_at_period_end: false,
            canceled_at: null,
          },
          { onConflict: "user_id" },
        )
      : await admin.from("subscriptions").upsert(
          {
            user_id: userId!,
            plan,
            status: "active",
            interval,
            billing_period: interval,
            access_type: "paid",
            access_expires_at: null,
            xendit_customer_id: body.id ?? null,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd,
            amount_paid: typeof body.amount === "number" ? body.amount : null,
            promo_code_id: null,
            promo_code: null,
            cancel_at_period_end: true,
            canceled_at: null,
          },
          { onConflict: "user_id" },
        );

    if (subError) {
      console.error("[xendit] subscription activation failed", subError.code);
      await releaseClaim(admin, claimed, eventId, status);
      return NextResponse.json(
        { received: false, error: "activation failed" },
        { status: 500 },
      );
    }

    await admin
      .from("promotion_offers")
      .update({ status: "redeemed" })
      .eq("user_id", userId)
      .eq("status", "active");
  } catch {
    await releaseClaim(admin, claimed, eventId, status);
    return NextResponse.json(
      { received: false, error: "activation failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}