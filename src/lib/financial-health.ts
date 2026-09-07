/**
 * Financial health score — deliberately simple and fully transparent.
 *
 * Every factor is a plain rule over data the user can see elsewhere in the app,
 * each contributes a fixed number of points, and each explains itself. There is
 * no model and no hidden weighting. A factor with nothing to judge (no budget
 * set, no goals) is marked "unknown" and dropped from BOTH sides of the ratio,
 * so the user is never punished for a feature they haven't started using.
 *
 * Pure and client-safe.
 */
import type { BudgetSummary, CashFlowForecast } from "@/lib/queries/planning";
import type { GoalsSummary } from "@/lib/queries/goals";

export type HealthStatus = "good" | "warn" | "bad" | "unknown";

export type HealthFactor = {
  key: string;
  label: string;
  points: number; // earned
  max: number; // possible
  status: HealthStatus;
  detail: string; // plain-language explanation shown to the user
};

export type FinancialHealth = {
  score: number; // 0–100 (null-safe: 0 when nothing is known)
  grade: "Excellent" | "Good" | "Fair" | "Needs work" | "Not enough data";
  factors: HealthFactor[];
  positives: HealthFactor[];
  needsAttention: HealthFactor[];
  known: boolean; // false when no factor could be judged
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function gradeFor(score: number): FinancialHealth["grade"] {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Needs work";
}

export function computeFinancialHealth(input: {
  budget: BudgetSummary;
  forecast: CashFlowForecast;
  goals: GoalsSummary;
  overdueBills: number;
  /** Total active bills — with none, "bills on time" has nothing to judge. */
  totalBills: number;
}): FinancialHealth {
  const { budget, forecast, goals, overdueBills, totalBills } = input;
  const factors: HealthFactor[] = [];

  // 1. Budget adherence (25) — how many allotments are still within their limit.
  if (budget.hasMonthlyBudget && budget.items.length > 0) {
    const within = budget.items.filter((i) => i.pct <= 100).length;
    const ratio = within / budget.items.length;
    const over = budget.items.length - within;
    factors.push({
      key: "budget_adherence",
      label: "Budget adherence",
      points: Math.round(25 * ratio),
      max: 25,
      status: ratio === 1 ? "good" : ratio >= 0.7 ? "warn" : "bad",
      detail:
        over === 0
          ? `All ${budget.items.length} categories are within budget.`
          : `${over} of ${budget.items.length} categories ${over === 1 ? "is" : "are"} over budget.`,
    });
  } else {
    factors.push({
      key: "budget_adherence",
      label: "Budget adherence",
      points: 0,
      max: 0,
      status: "unknown",
      detail: "Set a monthly budget with allotments to track this.",
    });
  }

  // 2. Overspending against the overall budget (15).
  if (budget.hasMonthlyBudget && budget.total > 0) {
    const used = budget.overallPct;
    // Pace-aware: being 60% through the month at 60% spent is fine.
    const expected =
      budget.daysInMonth > 0 ? (budget.dayOfMonth / budget.daysInMonth) * 100 : 0;
    const ok = used <= Math.max(expected + 10, 100);
    factors.push({
      key: "overspending",
      label: "Spending pace",
      points: ok ? 15 : used > 100 ? 0 : 8,
      max: 15,
      status: used > 100 ? "bad" : ok ? "good" : "warn",
      detail:
        used > 100
          ? `You've spent ${Math.round(used)}% of your monthly budget.`
          : `You've used ${Math.round(used)}% of your budget, ${Math.round(expected)}% through the month.`,
    });
  } else {
    factors.push({
      key: "overspending",
      label: "Spending pace",
      points: 0,
      max: 0,
      status: "unknown",
      detail: "Set a monthly budget to track your spending pace.",
    });
  }

  // 3. Savings target completion (20).
  if (budget.savingsTarget > 0) {
    const ratio = clamp01(budget.savingsFunded / budget.savingsTarget);
    factors.push({
      key: "savings_target",
      label: "Savings target",
      points: Math.round(20 * ratio),
      max: 20,
      status: ratio >= 0.99 ? "good" : ratio >= 0.5 ? "warn" : "bad",
      detail:
        ratio >= 0.99
          ? "You've fully funded this month's savings."
          : `${Math.round(ratio * 100)}% of this month's savings allocation is funded.`,
    });
  } else {
    factors.push({
      key: "savings_target",
      label: "Savings target",
      points: 0,
      max: 0,
      status: "unknown",
      detail: "Add a savings allocation to your monthly budget.",
    });
  }

  // 4. Cash-flow risk (20) — will the projected balance stay above zero?
  // With no money recorded and nothing due, there is genuinely nothing to
  // judge; scoring it would flag a brand-new account as at risk.
  const projected = forecast.projectedEndBalance;
  const noCashData =
    forecast.spendable === 0 && forecast.projectedRemainingSpend === 0;
  if (noCashData) {
    factors.push({
      key: "cash_flow",
      label: "Cash-flow safety",
      points: 0,
      max: 0,
      status: "unknown",
      detail: "Add your account balances to project your month-end cash.",
    });
  } else {
    const cushion =
      forecast.spendable > 0 ? clamp01(projected / forecast.spendable) : 0;
    factors.push({
      key: "cash_flow",
      label: "Cash-flow safety",
      points: projected < 0 ? 0 : Math.round(20 * Math.max(0.4, cushion)),
      max: 20,
      status: projected < 0 ? "bad" : cushion >= 0.25 ? "good" : "warn",
      detail:
        projected < 0
          ? "Your projected month-end balance is below zero."
          : "Your projected month-end balance stays positive.",
    });
  }

  // 5. Bills paid on time (10) — only meaningful once bills are tracked.
  if (totalBills === 0) {
    factors.push({
      key: "bills",
      label: "Bills on time",
      points: 0,
      max: 0,
      status: "unknown",
      detail: "Add your recurring bills to track whether they're paid on time.",
    });
  } else {
    factors.push({
      key: "bills",
      label: "Bills on time",
      points: overdueBills === 0 ? 10 : 0,
      max: 10,
      status: overdueBills === 0 ? "good" : "bad",
      detail:
        overdueBills === 0
          ? "No overdue bills."
          : `${overdueBills} bill${overdueBills === 1 ? " is" : "s are"} overdue.`,
    });
  }

  // 6. Savings goals / emergency fund progress (10).
  if (goals.totalTarget > 0) {
    const ratio = clamp01(goals.totalSaved / goals.totalTarget);
    factors.push({
      key: "goals",
      label: "Savings goals",
      points: Math.round(10 * ratio),
      max: 10,
      status: ratio >= 0.6 ? "good" : ratio >= 0.25 ? "warn" : "bad",
      detail: `Your savings goals are ${Math.round(ratio * 100)}% funded.`,
    });
  } else {
    factors.push({
      key: "goals",
      label: "Savings goals",
      points: 0,
      max: 0,
      status: "unknown",
      detail: "Add a savings goal or emergency fund to track this.",
    });
  }

  const totalMax = factors.reduce((s, f) => s + f.max, 0);
  const totalPoints = factors.reduce((s, f) => s + f.points, 0);
  const known = totalMax > 0;
  const score = known ? Math.round((totalPoints / totalMax) * 100) : 0;

  return {
    score,
    grade: known ? gradeFor(score) : "Not enough data",
    factors,
    positives: factors.filter((f) => f.status === "good"),
    needsAttention: factors.filter(
      (f) => f.status === "warn" || f.status === "bad",
    ),
    known,
  };
}
