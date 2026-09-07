"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkCap } from "@/lib/plan-guard";
import type { SavingsGoalType } from "@/lib/supabase/types";

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
  goalType: SavingsGoalType;
  targetDate?: string | null;
  monthlyTarget?: number | null;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.name.trim()) return { ok: false, error: "Name the goal." };
  if (!(input.targetAmount > 0)) {
    return { ok: false, error: "Enter a target amount." };
  }
  if (!Number.isFinite(input.savedAmount) || input.savedAmount < 0) {
    return { ok: false, error: "Enter a valid saved amount." };
  }
  if (
    !["standard", "sinking_fund", "emergency_fund"].includes(input.goalType)
  ) {
    return { ok: false, error: "Choose a valid goal type." };
  }
  if (
    input.monthlyTarget != null &&
    (!Number.isFinite(input.monthlyTarget) || input.monthlyTarget < 0)
  ) {
    return { ok: false, error: "Monthly target cannot be negative." };
  }

  const row = {
    name: input.name.trim(),
    target_amount: input.targetAmount,
    saved_amount: Math.max(0, input.savedAmount),
    color: input.color ?? null,
    goal_type: input.goalType,
    target_date: input.targetDate || null,
    monthly_target: input.monthlyTarget ?? null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("savings_goals")
      .update(row)
      .eq("id", input.id);
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

  const { data, error } = await supabase
    .from("savings_goals")
    .insert({ user_id: user.id, ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function deleteSavingsGoal(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("savings_goals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Add funds and record the contribution month in one database transaction. */
export async function contributeToGoal(
  id: string,
  amount: number,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(amount > 0)) return { ok: false, error: "Enter an amount." };

  const { error } = await supabase.rpc("contribute_to_savings_goal", {
    p_goal_id: id,
    p_amount: amount,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id };
}
