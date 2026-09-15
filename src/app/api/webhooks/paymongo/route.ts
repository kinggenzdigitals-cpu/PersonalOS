import { NextResponse, type NextRequest } from "next/server";
import { addMonths } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { paymongoLiveMode } from "@/lib/paymongo";
import { verifyPaymongoSignature } from "@/lib/paymongo-signature";
import {
  amountMatches,
  eventType,
  readPaidCheckout,
} from "@/lib/paymongo-event";
import {
  parseReference,
  PERIOD_MONTHS,
  type ParsedReference,
} from "@/lib/billing-reference";
import {
  activationConflict,
  type CheckoutKind,
  type ExistingAccess,
  type PaidTier,
} from "@/lib/checkout-eligibility";

/**
 * PayMongo webhook — the ONLY place paid access is granted.
 *
 * Setup: in the PayMongo dashboard (Developers → Webhooks) register
 * https://<domain>/api/webhooks/paymongo for `checkout_session.payment.paid`,
 * and set PAYMONGO_WEBHOOK_SECRET to that endpoint's secret.
 *
 * Order (scripts/paymongo-webhook-contract.test.cjs enforces it):
 *   1. read the RAW body and verify the Paymongo-Signature header against it;
 *   2. only then parse it;
 *   3. confirm the amount paid equals what checkout charged;
 *   4. skip a session that already reached a final outcome;
 *   5. activate, as ONE guarded write to the customer's subscriptions row;
 *   6. record the outcome.
 *
 * Correctness rests on step 5, not on any lock. Each activation is a single
 * compare-and-swap UPDATE (or a single INSERT) of the customer's one
 * subscriptions row, and that same statement stamps the checkout session id
 * onto the row. So:
 *
 *   - a redelivery of a session that already landed finds its own id on the
 *     row and is treated as applied. It can never extend a period twice,
 *     whether the first attempt crashed, lost its response, or failed to
 *     record PAID afterwards;
 *   - two payments for one customer can't both write from the same read. The
 *     loser's guard fails, it re-reads and decides again, so a second Lifetime
 *     lands on NEEDS_REFUND and no paid period is ever overwritten;
 *   - every other writer is caught as well, admin actions included, because
 *     the guard is updated_at, which a BEFORE UPDATE trigger sets to now() on
 *     every update (migration 0006).
 *
 * The session id is stored in subscriptions.xendit_customer_id. That column
 * has always meant "the provider's id for the payment behind this row", and
 * nothing else reads or writes it any more. Rename it to provider_payment_id
 * in a future migration.
 *
 * billing_events rows per session (event_id = the session id):
 *   PAID             applied; getLifetimeSold() counts it as a real sale
 *   NEEDS_REFUND     received, but deliberately not applied
 *   AMOUNT_MISMATCH  paid amount didn't match the checkout; not applied
 * If writing one of these fails, the route answers 5xx so PayMongo redelivers.
 * That is safe precisely because re-running an applied session only records it.
 *
 * Status codes follow PayMongo's retry behaviour (a failed delivery is retried
 * up to 12 times; 30s to answer). Anything that could succeed later answers
 * 5xx; anything that never can is acknowledged without activating.
 */

const PROVIDER = "paymongo";
const PAID = "PAID";
const NEEDS_REFUND = "NEEDS_REFUND";
const AMOUNT_MISMATCH = "AMOUNT_MISMATCH";
/** Re-reads allowed when another write to the same row wins the race. */
const MAX_ATTEMPTS = 4;

type Admin = ReturnType<typeof createAdminClient>;

type EventRow = {
  provider: string;
  event_id: string;
  external_id: string;
  user_id: string;
  status: string;
  amount: number;
};

type Outcome = { applied: true } | { conflict: string } | { failed: string };

function ack(extra: Record<string, unknown> = {}) {
  return NextResponse.json({ received: true, ...extra });
}

function retryLater(error: string) {
  return NextResponse.json({ received: false, error }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[paymongo] PAYMONGO_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { received: false, error: "not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signed = verifyPaymongoSignature({
    header: request.headers.get("paymongo-signature"),
    rawBody,
    secret,
    live: paymongoLiveMode(),
  });
  if (!signed) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (eventType(body) !== "checkout_session.payment.paid") {
    return ack({ ignored: true });
  }

  const checkout = readPaidCheckout(body);
  if (!checkout) {
    console.error("[paymongo] unreadable checkout_session.payment.paid event");
    return ack({ applied: false });
  }
  if (checkout.livemode !== paymongoLiveMode()) {
    console.error("[paymongo] event mode does not match the configured key", checkout.sessionId);
    return ack({ applied: false });
  }
  const ref = parseReference(checkout.reference);
  if (!ref) {
    console.error("[paymongo] unrecognised reference on", checkout.sessionId);
    return ack({ applied: false });
  }

  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    // A 2xx here would tell PayMongo the delivery succeeded and drop a real
    // payment. 503 keeps it retrying until the key is configured.
    console.error("[paymongo] service-role client unavailable");
    return NextResponse.json(
      { received: false, error: "not configured" },
      { status: 503 },
    );
  }

  const paidPHP = checkout.paidCentavos / 100;
  const row: EventRow = {
    provider: PROVIDER,
    event_id: checkout.sessionId,
    external_id: checkout.reference,
    user_id: ref.userId,
    status: PAID,
    amount: paidPHP,
  };

  if (!amountMatches(checkout)) {
    // Never activated: retrying can't change the amount. But the row MUST
    // exist for review, so a failed write is retried rather than acknowledged.
    console.error("[paymongo] paid amount does not match checkout", checkout.sessionId);
    if (!(await record(admin, { ...row, status: AMOUNT_MISMATCH }))) {
      return retryLater("event log failed");
    }
    return ack({ applied: false });
  }

  const settled = await alreadySettled(admin, checkout.sessionId);
  if (settled === "error") return retryLater("event log unavailable");
  if (settled) return ack({ duplicate: true });

  let outcome: Outcome;
  try {
    outcome = await activate(admin, ref, checkout.sessionId, checkout.reference, paidPHP);
  } catch {
    outcome = { failed: "activation threw" };
  }

  if ("failed" in outcome) return retryLater(outcome.failed);

  if ("conflict" in outcome) {
    console.error(
      `[paymongo] payment received but NOT applied (${outcome.conflict}); refund manually`,
      checkout.sessionId,
    );
    if (!(await record(admin, { ...row, status: NEEDS_REFUND }))) {
      return retryLater("event log failed");
    }
    return ack({ applied: false });
  }

  // Safe to retry if this fails: the redelivery finds the session id already on
  // the subscriptions row, treats it as applied, and only writes this record.
  if (!(await record(admin, row))) return retryLater("event log failed");
  return ack({ applied: true });
}

// ------------------------------------------------------------ event log

/** Insert an event row. True if written, or if an identical row already exists. */
async function record(admin: Admin, row: EventRow): Promise<boolean> {
  const { error } = await admin.from("billing_events").insert(row);
  return !error || error.code === "23505";
}

/** Whether this checkout session already reached a final outcome. */
async function alreadySettled(
  admin: Admin,
  sessionId: string,
): Promise<boolean | "error"> {
  const { data, error } = await admin
    .from("billing_events")
    .select("id")
    .eq("provider", PROVIDER)
    .eq("event_id", sessionId)
    .in("status", [PAID, NEEDS_REFUND])
    .limit(1);
  if (error) return "error";
  return (data ?? []).length > 0;
}

// ------------------------------------------------------------ activation

const ROW_COLUMNS =
  "plan, status, access_type, access_expires_at, current_period_end, updated_at, xendit_customer_id";

type SubscriptionRow = NonNullable<ExistingAccess> & {
  updated_at: string;
  xendit_customer_id: string | null;
};

/** The two ways to land an activation: create the row, or guarded-update it. */
type RowWrite = {
  insert: () => PromiseLike<{ error: { code: string } | null }>;
  update: (updatedAt: string) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
};

/**
 * Read → decide → write, with the write guarded on the updated_at that was
 * read. If anything touched the row in between, the guard matches nothing, and
 * the whole decision is taken again from a fresh read.
 */
async function guardedApply(
  admin: Admin,
  userId: string,
  sessionId: string,
  payment: { kind: CheckoutKind; plan: PaidTier | null },
  build: (existing: SubscriptionRow | null) => RowWrite,
): Promise<Outcome> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: existing, error } = await admin
      .from("subscriptions")
      .select(ROW_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle<SubscriptionRow>();
    if (error) return { failed: "subscription read failed" };

    // This session's activation already landed. The id is written in the same
    // statement as the access change, so this is proof, not a guess.
    if (existing?.xendit_customer_id === sessionId) return { applied: true };

    const conflict = activationConflict(existing, payment, Date.now());
    if (conflict) return { conflict };

    const write = build(existing);
    if (!existing) {
      const { error: insertError } = await write.insert();
      if (!insertError) return { applied: true };
      if (insertError.code === "23505") continue; // created concurrently: re-read
      return { failed: "activation failed" };
    }

    const { data: updated, error: updateError } = await write.update(existing.updated_at);
    if (updateError) return { failed: "activation failed" };
    if ((updated ?? []).length === 1) return { applied: true };
    // The row changed since it was read: go round again.
  }
  return { failed: "activation contention" };
}

async function activate(
  admin: Admin,
  ref: ParsedReference,
  sessionId: string,
  reference: string,
  paidPHP: number,
): Promise<Outcome> {
  if (ref.kind === "promo") {
    return activatePromo(admin, ref, sessionId, reference, paidPHP);
  }

  const outcome =
    ref.kind === "lifetime"
      ? await guardedApply(
          admin,
          ref.userId,
          sessionId,
          { kind: "lifetime", plan: ref.plan },
          () => {
            const values = {
              plan: ref.plan,
              status: "active" as const,
              interval: "lifetime",
              billing_period: "lifetime",
              access_type: "lifetime_pro" as const,
              access_expires_at: null,
              current_period_start: new Date().toISOString(),
              current_period_end: null,
              amount_paid: paidPHP,
              promo_code_id: null,
              promo_code: null,
              cancel_at_period_end: false,
              canceled_at: null,
              xendit_customer_id: sessionId,
            };
            return {
              insert: () =>
                admin.from("subscriptions").insert({ user_id: ref.userId, ...values }),
              update: (updatedAt: string) =>
                admin
                  .from("subscriptions")
                  .update(values)
                  .eq("user_id", ref.userId)
                  .eq("updated_at", updatedAt)
                  .select("user_id"),
            };
          },
        )
      : await guardedApply(
          admin,
          ref.userId,
          sessionId,
          { kind: "subscription", plan: ref.plan },
          (existing) => {
            // A renewal bought while a period is still running extends from its
            // end, so paying early never loses the days already paid for.
            const now = new Date();
            const end = existing?.current_period_end
              ? new Date(existing.current_period_end)
              : null;
            const base = end && end.getTime() > now.getTime() ? end : now;
            const values = {
              plan: ref.plan,
              status: "active" as const,
              interval: ref.period,
              billing_period: ref.period,
              access_type: "paid" as const,
              access_expires_at: null,
              current_period_start: now.toISOString(),
              current_period_end: addMonths(base, PERIOD_MONTHS[ref.period]).toISOString(),
              amount_paid: paidPHP,
              promo_code_id: null,
              promo_code: null,
              cancel_at_period_end: true,
              canceled_at: null,
              xendit_customer_id: sessionId,
            };
            return {
              insert: () =>
                admin.from("subscriptions").insert({ user_id: ref.userId, ...values }),
              update: (updatedAt: string) =>
                admin
                  .from("subscriptions")
                  .update(values)
                  .eq("user_id", ref.userId)
                  .eq("updated_at", updatedAt)
                  .select("user_id"),
            };
          },
        );

  if ("applied" in outcome) await consumeOffers(admin, ref.userId);
  return outcome;
}

async function activatePromo(
  admin: Admin,
  ref: Extract<ParsedReference, { kind: "promo" }>,
  sessionId: string,
  reference: string,
  paidPHP: number,
): Promise<Outcome> {
  const { data: redemption, error: redemptionError } = await admin
    .from("promo_redemptions")
    .select("id, promo_code_id, user_id, status")
    .eq("invoice_external_id", reference)
    .maybeSingle<{
      id: string;
      promo_code_id: string;
      user_id: string;
      status: string;
    }>();
  // "active" is accepted as well as "pending": a redelivery after the
  // subscriptions write landed must be able to finish the redemption update.
  if (
    redemptionError ||
    !redemption ||
    redemption.user_id !== ref.userId ||
    (redemption.status !== "pending" && redemption.status !== "active")
  ) {
    return { failed: "promo redemption not found" };
  }

  const { data: promo, error: promoError } = await admin
    .from("promo_codes")
    .select("id, code, plan, duration_months")
    .eq("id", redemption.promo_code_id)
    .maybeSingle<{
      id: string;
      code: string;
      plan: "pro" | "premium";
      duration_months: number;
    }>();
  if (promoError || !promo) return { failed: "promo code not found" };

  const startsAt = new Date();
  const expiresAt = addMonths(startsAt, promo.duration_months);

  const outcome = await guardedApply(
    admin,
    ref.userId,
    sessionId,
    { kind: "promo", plan: null },
    () => {
      const values = {
        plan: promo.plan,
        status: "active" as const,
        interval: `promo_${promo.duration_months}m`,
        billing_period: `promo_${promo.duration_months}m`,
        access_type: "promo" as const,
        access_expires_at: expiresAt.toISOString(),
        current_period_start: startsAt.toISOString(),
        current_period_end: expiresAt.toISOString(),
        amount_paid: paidPHP,
        promo_code_id: promo.id,
        promo_code: promo.code,
        cancel_at_period_end: true,
        canceled_at: null,
        xendit_customer_id: sessionId,
      };
      return {
        insert: () =>
          admin.from("subscriptions").insert({ user_id: ref.userId, ...values }),
        update: (updatedAt: string) =>
          admin
            .from("subscriptions")
            .update(values)
            .eq("user_id", ref.userId)
            .eq("updated_at", updatedAt)
            .select("user_id"),
      };
    },
  );

  if ("conflict" in outcome) {
    // The code isn't being honoured, so release its redemption-cap slot and
    // stop the checkout reading as "pending" forever.
    await admin
      .from("promo_redemptions")
      .update({ status: "canceled" })
      .eq("id", redemption.id)
      .eq("status", "pending");
    return outcome;
  }
  if ("failed" in outcome) return outcome;

  // Idempotent: only a still-pending redemption moves, so a redelivery after
  // this already ran changes nothing. If it fails, answering 5xx is safe too —
  // the redelivery skips straight past the (already applied) access change.
  const { error } = await admin
    .from("promo_redemptions")
    .update({
      status: "active",
      amount_paid: paidPHP,
      redeemed_at: startsAt.toISOString(),
      access_starts_at: startsAt.toISOString(),
      access_expires_at: expiresAt.toISOString(),
    })
    .eq("id", redemption.id)
    .eq("status", "pending");
  if (error) return { failed: "promo redemption update failed" };
  return { applied: true };
}

/** A completed purchase consumes any active limited-time offer (idempotent). */
async function consumeOffers(admin: Admin, userId: string) {
  await admin
    .from("promotion_offers")
    .update({ status: "redeemed" })
    .eq("user_id", userId)
    .eq("status", "active");
}
