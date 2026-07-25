import { createClient } from "@/lib/supabase/server";
import type { SavingsGoal } from "@/lib/supabase/types";

export type GoalsSummary = {
  goals: SavingsGoal[];
  totalTarget: number;
  totalSaved: number;
  overallPct: number;
};

export async function getSavingsGoals(): Promise<GoalsSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("savings_goals")
    .select("*")
    .order("sort_order")
    .order("created_at")
    .returns<SavingsGoal[]>();

  const goals = data ?? [];
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved = goals.reduce((s, g) => s + Number(g.saved_amount), 0);

  return {
    goals,
    totalTarget,
    totalSaved,
    overallPct: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0,
  };
}
