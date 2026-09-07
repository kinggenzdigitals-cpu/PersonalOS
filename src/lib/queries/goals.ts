import { createClient } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/date";
import { sinkingFundMath, type SinkingFundMath } from "@/lib/sinking-funds";
import type { SavingsGoal } from "@/lib/supabase/types";

export type SinkingFund = { goal: SavingsGoal; math: SinkingFundMath };

/** Savings goals that have a target date, with their contribution maths. */
export async function getSinkingFunds(timezone: string): Promise<SinkingFund[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("savings_goals")
    .select("*")
    .not("target_date", "is", null)
    .order("target_date")
    .returns<SavingsGoal[]>();
  const todayKey = localDateKey(timezone);
  return (data ?? []).map((goal) => ({
    goal,
    math: sinkingFundMath(goal, todayKey),
  }));
}

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
