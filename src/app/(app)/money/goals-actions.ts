"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkCap } from "@/lib/plan-guard";
import { isSchemaMissing } from "@/lib/supabase/errors";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function auth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
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
    if (error) return { ok: false, error: error.message };
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
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data?.id };
}

export async function deleteSavingsGoal(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("savings_goals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Add (or subtract, if negative) funds to a goal's saved amount. */
export async function contributeToGoal(
  id: string,
  amount: number,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { data: goal, error: getErr } = await supabase
    .from("savings_goals")
    .select("saved_amount")
    .eq("id", id)
    .single<{ saved_amount: number }>();
  if (getErr || !goal) {
    return { ok: false, error: getErr?.message ?? "Goal not found." };
  }

  const next = Math.max(0, Number(goal.saved_amount) + amount);
  const { error } = await supabase
    .from("savings_goals")
    .update({ saved_amount: next })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id };
}
