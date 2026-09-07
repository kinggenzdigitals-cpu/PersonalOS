/**
 * Sinking-fund maths — pure and client-safe (no Supabase imports) so both the
 * server query and the goal card can share one definition.
 */
import type { SavingsGoal } from "@/lib/supabase/types";

export type SinkingFundMath = {
  monthsLeft: number; // calendar months until target (min 1 while not yet due)
  requiredMonthly: number; // (target − saved) / monthsLeft, 0 when reached
  pct: number; // 0–100 capped
  reached: boolean;
  overdue: boolean; // target date passed and not reached
};

export function sinkingFundMath(
  goal: Pick<SavingsGoal, "target_amount" | "saved_amount" | "target_date">,
  todayKey: string, // YYYY-MM-DD in the user's timezone
): SinkingFundMath {
  const target = Number(goal.target_amount);
  const saved = Number(goal.saved_amount);
  const gap = Math.max(0, target - saved);
  const reached = gap <= 0;
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;

  const [ty, tm] = (goal.target_date ?? todayKey).split("-").map(Number);
  const [ny, nm] = todayKey.split("-").map(Number);
  const rawMonths = (ty - ny) * 12 + (tm - nm);
  const overdue = !reached && rawMonths < 0;
  const monthsLeft = Math.max(1, rawMonths);

  return {
    monthsLeft,
    requiredMonthly: reached ? 0 : gap / monthsLeft,
    pct,
    reached,
    overdue,
  };
}
