/**
 * Budget maths: the vs.-actual report, the per-category carry-over envelopes,
 * and the month's headline totals.
 *
 * Split out of `queries/planning.ts` for the same reason as budget-advice.ts:
 * that module reaches for the Supabase server client at import time, so any
 * arithmetic living inside it can never be run by the tsc + bare-node harness.
 * Everything here is pure and structurally typed — no database rows, no `@/`
 * imports — so the harness can compile this one file on its own.
 *
 * The caller hands over already-aggregated figures (the month's budgets, the
 * month's expense totals per category, last month's spending); this file only
 * reshapes them.
 *
 * ---------------------------------------------------------------------------
 * ROUNDING POLICY
 * ---------------------------------------------------------------------------
 * Every money figure is snapped to centavos (2 dp) on the way in and after
 * every sum. Two reasons, both load-bearing:
 *
 *   1. The status bands ask exact questions — "is actual EQUAL to budget?",
 *      "is remaining exactly 0?" — and those are meaningless on raw IEEE
 *      doubles. A month of ₱0.10 + ₱0.20 expenses against a ₱0.30 budget sums
 *      to 0.30000000000000004 and would report "Over Budget" by a hundredth of
 *      a centavo.
 *   2. `remaining` is rendered by <Money>, and a subtraction like 5000 − 3500
 *      that arrived via float addition can land on 1499.9999999999998; the
 *      table would then show a remainder that does not tie back to the two
 *      numbers printed beside it.
 *
 * Percentages are snapped to 2 dp for the same reason — the badge is derived
 * from the same rounded number the table prints, so a row can never read
 * "80%" while wearing a "Within Budget" badge. Percentages are NEVER capped:
 * 130% stays 130%. Capping is a bar-width concern and belongs in the UI.
 */

export type BudgetStatus = "within" | "near" | "at" | "over" | "none";

export type BudgetReportRow = {
  /** null => the Unbudgeted bucket. */
  categoryId: string | null;
  /** "Unbudgeted" for the bucket. */
  categoryName: string;
  /** null => no budget for this category. */
  budget: number | null;
  actual: number;
  /** null when there is no positive budget to be remaining of. */
  remaining: number | null;
  /** UNCAPPED (130 stays 130). null when there is no positive budget. */
  pctUsed: number | null;
  /** actual / totalActual × 100; 0 when totalActual is 0. */
  sharePct: number;
  status: BudgetStatus;
};

export type BudgetReport = {
  /** Budgeted rows first (desc pctUsed), Unbudgeted bucket LAST. */
  rows: BudgetReportRow[];
  /** Σ category budgets. EXCLUDES savingsTarget. */
  totalBudget: number;
  /** ALL month expenses incl. unbudgeted + uncategorised. */
  totalActual: number;
  /** Expenses in categories that have a budget row. */
  budgetedActual: number;
  /** totalActual − budgetedActual; equals the Unbudgeted row's actual. */
  unbudgetedActual: number;
  /** null when totalBudget <= 0 — same rule as the rows. */
  remaining: number | null;
  /** null when totalBudget <= 0. */
  pctUsed: number | null;
  status: BudgetStatus;
  savingsTarget: number;
  savingsFunded: number;
};

/** The single bucket every unbudgeted and uncategorised peso falls into. */
const UNBUDGETED = "Unbudgeted";

/** Shown when a budget row arrives with a blank category name. */
const UNNAMED = "Untitled category";

/**
 * Snaps a money value to centavos.
 *
 * Non-finite input collapses to 0 rather than propagating: one corrupt row
 * (a NULL that became NaN on the way out of the database, a divide that got
 * away) must not turn the whole report into NaN and blank the table.
 */
function cents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Snaps a percentage to 2 dp. Never capped — see the rounding policy above. */
function pct2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * The status bands, applied to centavo-rounded values.
 *
 * A budget of 0 (or a negative one) is "none", not "over" — a person who has
 * not budgeted a category has not overspent it, and dividing by it would hand
 * the UI an Infinity to render.
 */
export function budgetStatus(
  budget: number | null,
  actual: number,
): BudgetStatus {
  if (budget === null || !Number.isFinite(budget)) return "none";
  const b = cents(budget);
  if (b <= 0) return "none";
  const a = cents(actual);
  if (a > b) return "over";
  if (a === b) return "at";
  return pct2((a / b) * 100) >= 80 ? "near" : "within";
}

export function statusLabel(s: BudgetStatus): string {
  switch (s) {
    case "over":
      return "Over Budget";
    case "at":
      return "At Limit";
    case "near":
      return "Near Limit";
    case "within":
      return "Within Budget";
    default:
      return "No Budget";
  }
}

export function buildBudgetReport(input: {
  budgets: { categoryId: string; categoryName: string; amount: number }[];
  actualByCategory: {
    categoryId: string | null;
    categoryName: string | null;
    amount: number;
  }[];
  savingsTarget?: number;
  savingsFunded?: number;
}): BudgetReport {
  const budgets = input?.budgets ?? [];
  const actuals = input?.actualByCategory ?? [];

  // Insertion order is kept separately from the Map so the sort below has a
  // stable base to fall back on when two categories tie on pctUsed.
  const order: string[] = [];
  const amountById = new Map<string, number>();
  const nameById = new Map<string, string>();

  for (const b of budgets) {
    if (!b || b.categoryId == null) continue;
    const id = b.categoryId;
    if (!amountById.has(id)) {
      order.push(id);
      nameById.set(id, b.categoryName || UNNAMED);
    }
    // Duplicate budget rows for one category are summed rather than dropped:
    // a silently ignored row would understate the budget and make a healthy
    // month look overspent.
    amountById.set(id, cents((amountById.get(id) ?? 0) + cents(b.amount)));
  }

  const actualById = new Map<string, number>();
  let unbudgetedActual = 0;
  let totalActual = 0;

  for (const a of actuals) {
    if (!a) continue;
    const amt = cents(a.amount);
    totalActual = cents(totalActual + amt);
    const id = a.categoryId;
    if (id != null && amountById.has(id)) {
      // Aggregate defensively: the caller may hand over one row per category
      // or several, and the report must total the same either way.
      actualById.set(id, cents((actualById.get(id) ?? 0) + amt));
    } else {
      // Uncategorised spending (categoryId null) and spending in categories
      // with no budget share ONE bucket, so no peso a person actually spent
      // can disappear between the transaction list and this table.
      unbudgetedActual = cents(unbudgetedActual + amt);
    }
  }

  const budgetedActual = cents(totalActual - unbudgetedActual);

  // Guarded against a zero month rather than allowed to produce NaN: an empty
  // month is a legitimate state and every share of it is 0.
  const share = (amount: number) =>
    totalActual === 0 ? 0 : pct2((amount / totalActual) * 100);

  const rows: BudgetReportRow[] = order.map((id) => {
    const budget = amountById.get(id) ?? 0;
    const actual = actualById.get(id) ?? 0;
    // A non-positive budget has nothing to be remaining of, so remaining and
    // pctUsed are null exactly when the status is "none". Printing
    // "−₱6,500 remaining" against a ₱0 budget would read as an overspend the
    // person never signed up for.
    const live = budget > 0;
    return {
      categoryId: id,
      categoryName: nameById.get(id) ?? UNNAMED,
      budget,
      actual,
      remaining: live ? cents(budget - actual) : null,
      pctUsed: live ? pct2((actual / budget) * 100) : null,
      sharePct: share(actual),
      status: budgetStatus(budget, actual),
    };
  });

  // Worst-first, so the row a person needs to act on is the first one they
  // read. Rows with no usable percentage sort to the bottom of the budgeted
  // block; ties fall back to the category name so the order never jitters
  // between renders of the same data.
  rows.sort((a, b) => {
    const ap = a.pctUsed;
    const bp = b.pctUsed;
    if (ap === null && bp === null) return a.categoryName.localeCompare(b.categoryName);
    if (ap === null) return 1;
    if (bp === null) return -1;
    if (ap !== bp) return bp - ap;
    return a.categoryName.localeCompare(b.categoryName);
  });

  // The bucket is appended after the sort so it is always the last row, no
  // matter how big it grew.
  if (unbudgetedActual !== 0) {
    rows.push({
      categoryId: null,
      categoryName: UNBUDGETED,
      budget: null,
      actual: unbudgetedActual,
      remaining: null,
      pctUsed: null,
      sharePct: share(unbudgetedActual),
      status: "none",
    });
  }

  let totalBudget = 0;
  for (const id of order) totalBudget = cents(totalBudget + (amountById.get(id) ?? 0));

  // savingsTarget is deliberately NOT folded into totalBudget. Savings move by
  // transfer, not expense, so adding the target here would inflate the budget
  // the expenses are measured against and make an overspent month look fine.
  //
  // The totals obey the same rule as the rows: with no budget in force there is
  // nothing to be remaining OF, so `remaining` is null rather than a negative
  // number. A person who has not set a budget yet has not overspent one, and
  // "Over budget ₱6,500" printed beside its own "No Budget" pill and "—"
  // percentage is a contradiction the reader has to resolve on our behalf.
  const live = totalBudget > 0;
  return {
    rows,
    totalBudget,
    totalActual,
    budgetedActual,
    unbudgetedActual,
    remaining: live ? cents(totalBudget - totalActual) : null,
    pctUsed: live ? pct2((totalActual / totalBudget) * 100) : null,
    status: budgetStatus(totalBudget, totalActual),
    savingsTarget: cents(input?.savingsTarget ?? 0),
    savingsFunded: cents(input?.savingsFunded ?? 0),
  };
}

/* -------------------------------------------------------------------------- */
/*  Per-category envelopes (carry-over)                                        */
/* -------------------------------------------------------------------------- */

/**
 * Stand-in percentage for a row that is over budget with nothing positive to
 * divide by. Only "greater than 100" is load-bearing — it is never printed,
 * because an over-budget row prints the amount it is over by, not a ratio.
 * Unreachable from the database, where `budgets.amount` is `check (amount > 0)`.
 */
const OVER_WITHOUT_DENOMINATOR = 101;

export type BudgetEnvelope = {
  /** Signed leftover rolled in from last month; 0 when nothing is carried. */
  carryIn: number;
  /** amount + carryIn — what is actually spendable this month. */
  effective: number;
  /** effective − spent. Negative means over budget. */
  remaining: number;
  /** Percentage of the envelope consumed. Uncapped, and > 100 exactly when remaining < 0. */
  pct: number;
};

/**
 * One category's envelope for the month: this month's allotment plus whatever
 * last month left behind (a surplus rolls forward, and so does an overspend).
 *
 * `lastAmount` is last month's allotment, and is NULL whenever it cannot be
 * known — carry-over is off, the budget did not exist last month, or the row
 * has been edited since. A null carries nothing in. That understates the
 * envelope, which is recoverable; inventing one is not.
 *
 * `pct` and `remaining` are required to agree. Over-budget is tested as
 * `pct > 100` by the dashboard alerts, the advice engine, the budget card and
 * the health score, so a row whose `remaining` is negative must never report
 * 100 or less — reporting exactly 100 for a blown envelope downgraded a red
 * "over by ₱5,000" to a yellow "at 100% of budget", and reporting 0 (the
 * carried-a-deficit-but-spent-nothing case) painted it green.
 *
 * A carried-over deficit can leave `effective` at or below zero, which is no
 * longer a denominator. That case measures everything consumed — this month's
 * spending plus the deficit rolled in — against the month's own allotment
 * instead, which keeps the agreement exact: consumed > allotment happens
 * exactly when spent > effective.
 */
export function budgetEnvelope(input: {
  amount: number;
  spent: number;
  /** Last month's allotment, or null when it cannot be known. */
  lastAmount: number | null;
  lastSpent?: number;
}): BudgetEnvelope {
  const amount = cents(input?.amount ?? 0);
  const spent = cents(input?.spent ?? 0);
  const lastAmount =
    input?.lastAmount == null ? null : cents(input.lastAmount);
  const lastSpent = cents(input?.lastSpent ?? 0);

  const carryIn = lastAmount === null ? 0 : cents(lastAmount - lastSpent);
  const effective = cents(amount + carryIn);
  const remaining = cents(effective - spent);

  const pct =
    effective > 0
      ? pct2((spent / effective) * 100)
      : amount > 0
        ? pct2(((spent - carryIn) / amount) * 100)
        : remaining < 0
          ? OVER_WITHOUT_DENOMINATOR
          : 0;

  return { carryIn, effective, remaining, pct };
}

/* -------------------------------------------------------------------------- */
/*  Monthly headline totals                                                    */
/* -------------------------------------------------------------------------- */

export type MonthlyBudgetTotals = {
  /** total − savingsTarget: the part of the month's budget expenses may use. */
  expenseBudget: number;
  /** categoryAllocated + savingsTarget — every commitment made against total. */
  allocated: number;
  /** total − allocated. Negative means over-allocated. */
  unallocated: number;
  /** expenseBudget − spent. Negative means overspent. */
  remaining: number;
  /** spent / expenseBudget × 100, uncapped. 0 when there is no expense budget. */
  overallPct: number;
};

/**
 * The month's headline figures, from the overall budget down.
 *
 * Two rules, both of which the screens got wrong in opposite directions:
 *
 *   1. Savings is NOT spendable. The target leaves the spending accounts by
 *      transfer, so folding it into the pot the month's expenses are measured
 *      against reports it as still available — and goes on reporting it after
 *      it has actually been moved, because funding savings never registers as
 *      an expense. The expense budget is therefore `total − savingsTarget`,
 *      which is exactly what the budget editor already calls "unallocated after
 *      savings … to divide across categories", and what `buildBudgetReport`
 *      means when it refuses to add the target into `totalBudget`.
 *
 *   2. `spent` must be EVERY expense in the month, not just the ones that
 *      landed in a category with a budget row. `total` covers the whole month,
 *      so a narrower numerator hides unbudgeted and uncategorised spending
 *      from the headline percentage entirely — always in the reassuring
 *      direction, and always contradicting the vs.-actual table, which counts
 *      every peso.
 *
 * Where the target fits inside the total (the editor enforces it), the result
 * satisfies `total = spent + remaining + savingsTarget`, so no part of what the
 * person budgeted goes unaccounted for.
 */
export function monthlyBudgetTotals(input: {
  total: number;
  savingsTarget: number;
  categoryAllocated: number;
  /** Σ ALL of the month's expenses, budgeted or not. */
  spent: number;
}): MonthlyBudgetTotals {
  const total = cents(input?.total ?? 0);
  const savingsTarget = cents(input?.savingsTarget ?? 0);
  const categoryAllocated = cents(input?.categoryAllocated ?? 0);
  const spent = cents(input?.spent ?? 0);

  // A target larger than the total is over-commitment, not negative budget:
  // `unallocated` is where that shows up, and a below-zero expense budget would
  // only turn into a nonsense "remaining".
  const expenseBudget = Math.max(0, cents(total - savingsTarget));
  const allocated = cents(categoryAllocated + savingsTarget);

  return {
    expenseBudget,
    allocated,
    unallocated: cents(total - allocated),
    remaining: cents(expenseBudget - spent),
    overallPct: expenseBudget > 0 ? pct2((spent / expenseBudget) * 100) : 0,
  };
}
