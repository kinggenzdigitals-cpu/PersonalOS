"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSchemaMissing, migrationRequired } from "@/lib/supabase/errors";
import type { Subscription } from "@/lib/supabase/types";

export type SubscriptionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Subscriptions are select-only for `authenticated` (0006), so these writes go
 * through the service role — but always scoped to the caller's own user_id,
 * which is read from the session and never accepted as an argument.
 */
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

type SubRow = Pick<
  Subscription,
  "plan" | "status" | "access_type" | "current_period_end"
> & { cancel_at_period_end?: boolean | null };

/**
 * Read the caller's subscription with `select("*")`, so a not-yet-applied
 * migration can't fail the read on an unknown column, and surface any real
 * error instead of silently reporting "no paid plan".
 */
async function readSubscription(
  userId: string,
): Promise<{ row: SubRow | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<SubRow>();

  if (error) {
    return {
      row: null,
      error: isSchemaMissing(error)
        ? migrationRequired("Subscriptions", "0006")
        : "Couldn't read your subscription. Please try again.",
    };
  }
  return { row: data ?? null };
}

/**
 * Turn off renewal. Billing is invoice-based, so nothing is refunded and
 * nothing is charged: the user keeps the access they paid for until
 * current_period_end and then lapses to Free.
 */
export async function cancelSubscription(): Promise<SubscriptionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "You're not signed in." };

  // `select("*")` on purpose: naming cancel_at_period_end would make the whole
  // read fail before migration 0017 is applied, and a paying subscriber would
  // be told they have no paid plan.
  const sub = await readSubscription(userId);
  if (sub.error) return { ok: false, error: sub.error };
  const row = sub.row;

  if (!row || row.plan === "free") {
    return { ok: false, error: "You don't have a paid plan to cancel." };
  }
  if (row.access_type !== "paid") {
    // Complimentary and lifetime access don't renew, so there is nothing to
    // cancel — and writing the flag would imply a lapse that never happens.
    return {
      ok: false,
      error:
        row.access_type === "lifetime_pro"
          ? "Lifetime access doesn't renew, so there's nothing to cancel."
          : "Your access was granted by an admin and doesn't renew — there's nothing to cancel.",
    };
  }
  if (row.cancel_at_period_end) {
    return { ok: false, error: "Renewal is already turned off." };
  }
  if (
    !row.current_period_end ||
    new Date(row.current_period_end).getTime() <= Date.now()
  ) {
    return {
      ok: false,
      error: "Your plan has already ended, so there's nothing to cancel.",
    };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Billing isn't configured. Contact support." };
  }

  const { error } = await admin
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    if (isSchemaMissing(error)) {
      return { ok: false, error: migrationRequired("Cancellation", "0017") };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "Renewal is off. You keep full access until your paid period ends.",
  };
}

/**
 * Undo a pending cancellation while the paid period is still running. Guards
 * mirror cancelSubscription's — this is an exported server action, so the UI
 * gating in PlanCard is presentation, not protection.
 */
export async function resumeSubscription(): Promise<SubscriptionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "You're not signed in." };

  const sub = await readSubscription(userId);
  if (sub.error) return { ok: false, error: sub.error };
  const row = sub.row;

  if (!row || row.plan === "free" || row.access_type !== "paid") {
    return { ok: false, error: "You don't have a paid plan to resume." };
  }
  if (!row.cancel_at_period_end) {
    return { ok: false, error: "Renewal is already on." };
  }
  if (
    !row.current_period_end ||
    new Date(row.current_period_end).getTime() <= Date.now()
  ) {
    return {
      ok: false,
      error: "Your plan has already ended. Renew it to start a new period.",
    };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Billing isn't configured. Contact support." };
  }

  const { error } = await admin
    .from("subscriptions")
    .update({ cancel_at_period_end: false, canceled_at: null })
    .eq("user_id", userId);

  if (error) {
    if (isSchemaMissing(error)) {
      return { ok: false, error: migrationRequired("Cancellation", "0017") };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Renewal is back on." };
}
