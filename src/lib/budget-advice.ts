/**
 * Rule-based monthly-budget guidance.
 *
 * Split out of `queries/planning.ts` so it can be exercised on its own: the
 * query module reaches for Supabase at import time, which makes the maths
 * inside it untestable. Everything here is pure and structurally typed — no
 * database rows, no `@/` imports — so the test harness can compile this single
 * file the same way it compiles csv.ts and reconcile.ts.
 *
 * No ML and no invented figures: every sentence is derived from numbers the
 * caller already computed from exact numeric columns.
 */

export type AdviceTone = "warn" | "info" | "success";

export type BudgetRecommendation = {
  tone: AdviceTone;
  text: string;
};

/** One per-category budget line, reduced to just what the rules read. */
export type AdviceItem = {
  /** Category name; null/empty falls back to "A category". */
  name: string | null;
  /** The category's budgeted amount for the month. */
  amount: number;
  spent: number;
  /** effective − spent. Negative means over budget. */
  remaining: number;
  /** spent / effective × 100, uncapped. */
  pct: number;
};

export type AdviceInput = {
  hasMonthlyBudget: boolean;
  /** Overall monthly budget. */
  total: number;
  savingsTarget: number;
  savingsFunded: number;
  /** Σ spent across budgeted categories. */
  spent: number;
  /** total − allocated. Negative means over-allocated. */
  unallocated: number;
  dayOfMonth: number;
  daysInMonth: number;
  daysLeft: number;
  items: AdviceItem[];
};

/** Most recommendations we ever show, so the card stays scannable. */
export const MAX_RECOMMENDATIONS = 6;

/** Amounts within half a peso of zero are treated as balanced, not a problem. */
const EPSILON = 0.5;

/** Money inside recommendation text, so <MaskAmounts> can hide it on demand. */
export function money(n: number, sym: string): string {
  return `${sym}${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

function days(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

export function buildBudgetRecommendations(
  s: AdviceInput,
  symbol = "₱",
): BudgetRecommendation[] {
  if (!s.hasMonthlyBudget) return [];
  const m = (n: number) => money(n, symbol);

  const warn: BudgetRecommendation[] = [];
  const info: BudgetRecommendation[] = [];

  // Allocation coverage.
  if (s.unallocated > EPSILON) {
    info.push({
      tone: "info",
      text: `You have ${m(s.unallocated)} left to allocate.`,
    });
  } else if (s.unallocated < -EPSILON) {
    warn.push({
      tone: "warn",
      text: `You've over-allocated by ${m(s.unallocated)}. Trim a category or raise your budget.`,
    });
  }

  // Over-total spending.
  if (s.spent > s.total + EPSILON) {
    warn.push({
      tone: "warn",
      text: `You've spent ${m(s.spent)} — more than your ${m(s.total)} budget this month.`,
    });
  }

  // Per-category: over budget, then near limit, then pace.
  for (const i of s.items) {
    const name = i.name || "A category";
    if (i.pct > 100) {
      warn.push({ tone: "warn", text: `${name} is over by ${m(-i.remaining)}.` });
    } else if (i.pct >= 80 && s.daysLeft > 0) {
      warn.push({
        tone: "warn",
        text: `${name} is at ${Math.round(i.pct)}% with ${days(s.daysLeft)} left.`,
      });
    } else if (i.spent > 0 && s.dayOfMonth >= 5) {
      // Pace-based month-end forecast, labelled as an estimate. Guarded on
      // day >= 5 because two days of spending predicts nothing useful.
      const projected = (i.spent / s.dayOfMonth) * s.daysInMonth;
      if (projected > i.amount * 1.05) {
        info.push({
          tone: "info",
          text: `At this pace ${name} is on track for about ${m(projected)} by month-end (budget ${m(i.amount)}).`,
        });
      }
    }
  }

  // Savings: funded = transfers into savings-type accounts this month.
  if (s.savingsTarget > 0) {
    const gap = s.savingsTarget - s.savingsFunded;
    if (gap <= EPSILON) {
      info.push({
        tone: "success",
        text: `Savings funded: ${m(s.savingsFunded)} moved to savings this month.`,
      });
    } else if (s.daysLeft <= 5) {
      warn.push({
        tone: "warn",
        text: `${m(gap)} of your savings allocation is still unfunded with ${days(s.daysLeft)} left.`,
      });
    } else {
      info.push({
        tone: "info",
        text: `Savings: ${m(s.savingsFunded)} of ${m(s.savingsTarget)} moved so far — ${m(gap)} to go.`,
      });
    }
  }

  // Warnings first; cap to keep the card scannable.
  return [...warn, ...info].slice(0, MAX_RECOMMENDATIONS);
}
