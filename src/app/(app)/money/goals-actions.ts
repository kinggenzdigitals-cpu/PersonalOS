"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth";
import { checkCap } from "@/lib/plan-guard";
import { friendlyDbError, isSchemaMissing } from "@/lib/supabase/errors";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function auth() {
  // requireActiveUser() is null for a suspended / revoked account as well as a
  // signed-out one, so callers refuse the write either way.
  const active = await requireActiveUser();
  if (active) return active;
  return { supabase: await createClient(), user: null };
}

function revalidate() {
  revalidatePath("/", "layout");
}

export async function upsertSavingsGoal(input: {
  id?: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  color?: string | null;
  targetDate?: string | null; // YYYY-MM-DD → makes the goal a sinking fund
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.name.trim()) return { ok: false, error: "Name the goal." };
  if (!(input.targetAmount > 0)) {
    return { ok: false, error: "Enter a target amount." };
  }
  const targetDate = input.targetDate?.trim() || null;
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return { ok: false, error: "Enter a valid target date." };
  }

  // `target_date` arrives with migration 0012 — every write retries without it
  // if the column isn't there yet, so goals stay editable on an older database.
  const base = {
    name: input.name.trim(),
    target_amount: input.targetAmount,
    saved_amount: Math.max(0, input.savedAmount),
    color: input.color ?? null,
  };
  const row = { ...base, target_date: targetDate };

  if (input.id) {
    let { error } = await supabase
      .from("savings_goals")
      .update(row)
      .eq("id", input.id);
    if (isSchemaMissing(error)) {
      ({ error } = await supabase
        .from("savings_goals")
        .update(base)
        .eq("id", input.id));
    }
    if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this goal.") };
    revalidate();
    return { ok: true, id: input.id };
  }

  const { count } = await supabase
    .from("savings_goals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const capError = await checkCap("goals", count ?? 0);
  if (capError) return { ok: false, error: capError };

  let { data, error } = await supabase
    .from("savings_goals")
    .insert({ user_id: user.id, ...row })
    .select("id")
    .single();
  if (isSchemaMissing(error)) {
    ({ data, error } = await supabase
      .from("savings_goals")
      .insert({ user_id: user.id, ...base })
      .select("id")
      .single());
  }
  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this goal.") };
  revalidate();
  return { ok: true, id: data?.id };
}

export async function deleteSavingsGoal(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("savings_goals").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't delete this goal.") };
  revalidate();
  return { ok: true };
}

/**
 * Add (or subtract, if negative) funds to a goal's saved amount.
 *
 * The sum is computed here from a value just read, so the write is a
 * compare-and-set on that value: two devices contributing at once would
 * otherwise both read 1000, both write 1500, and one contribution would
 * vanish. If the row changed in between, nothing is written and we re-read.
 */
export async function contributeToGoal(
  id: string,
  amount: number,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: goal, error: getErr } = await supabase
      .from("savings_goals")
      .select("saved_amount")
      .eq("id", id)
      .single<{ saved_amount: number }>();
    if (getErr || !goal) {
      return { ok: false, error: friendlyDbError(getErr, "Goal not found.") };
    }

    const next = Math.max(0, Number(goal.saved_amount) + amount);
    const { data: updated, error } = await supabase
      .from("savings_goals")
      .update({ saved_amount: next })
      .eq("id", id)
      .eq("saved_amount", goal.saved_amount)
      .select("id");
    if (error) return { ok: false, error: friendlyDbError(error, "Couldn't update this goal.") };
    if (updated && updated.length > 0) {
      revalidate();
      return { ok: true, id };
    }
  }
  return {
    ok: false,
    error: "This goal changed while saving. Please try again.",
  };
}
