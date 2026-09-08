import { differenceInCalendarDays, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { monthRange, localDateKey } from "@/lib/date";
import { currencySymbol } from "@/lib/format";
import {
  buildBudgetRecommendations as buildAdvice,
  type BudgetRecommendation,
} from "@/lib/budget-advice";
import {
  buildBudgetReport,
  budgetEnvelope,
  monthlyBudgetTotals,
  type BudgetReport,
} from "@/lib/budget-report";
import { getAccountsWithBalances } from "@/lib/queries/money";
import type {
  Account,
  Bill,
  Budget,
  Category,
  MonthlyBudget,
  Transaction,
} from "@/lib/supabase/types";

export type BudgetWithSpending = {
  budget: Budget;
  category: Category | null;
  spent: number;
  carryIn: number; // signed leftover rolled in from last month (0 unless carryover)
  effective: number; // amount + carryIn — what's actually spendable this month
  remaining: number; // effective − spent
  // Share of the envelope consumed, uncapped. Above 100 exactly when remaining
  // is negative, which is the test every consumer uses for "over budget" —
  // see budgetEnvelope for the non-positive-envelope case.
  pct: number;
};

/** Sum expense amounts per category id. Uncategorised expenses are skipped. */
function sumByCategory(
  rows: Pick<Transaction, "amount" | "category_id">[] | null,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of rows ?? []) {
    if (!e.category_id) continue;
    map.set(e.category_id, (map.get(e.category_id) ?? 0) + Number(e.amount));
  }
  return map;
}

/* -------------------------------------------------------------------------- */
/*  Reading a whole month of transactions                                      */
/* -------------------------------------------------------------------------- */

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type ExpenseRow = Pick<Transaction, "amount" | "category_id">;

/** The shape of a PostgREST response, narrowed to what the pager reads. */
type PagedRows<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
};

/**
 * Every row a filter matches — not just the first page.
 *
 * PostgREST caps an un-ranged select at the project's `max-rows` (1000 by
 * default) and returns the truncated page with NO error, so a heavy month would
 * silently under-report spending and paint an over-budget month as comfortably
 * under. We therefore walk explicit ranges and cross-check the row count we
 * assembled against the server's exact count of matching rows.
 *
 * Every sum over a month of transactions goes through here. Three of them used
 * to issue plain un-ranged selects beside this pager, which meant the same
 * month could be reported twice with different totals depending on which
 * screen asked.
 *
 * The caller's `page` builder MUST order by a unique column: ranges over an
 * unordered result set aren't guaranteed stable between requests, so rows could
 * repeat or vanish between pages.
 */
async function fetchAllRows<T>(
  what: string,
  page: (from: number, to: number) => PromiseLike<PagedRows<T>>,
): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  let matching: number | null = null; // the server's own count, once we have it
  let from = 0;

  while (matching === null || rows.length < matching) {
    const { data, error, count } = await page(from, from + PAGE - 1);

    if (error) {
      throw new Error(`Failed to load the month's ${what}: ${error.message}`);
    }
    if (typeof count === "number") matching = count;

    const chunk = data ?? [];
    if (chunk.length === 0) break;
    rows.push(...chunk);
    // Step by what actually came back rather than by PAGE: a project configured
    // with a smaller `max-rows` hands back a short page with no error, and
    // striding past the rows it withheld would drop them from the totals.
    from += chunk.length;
  }

  if (matching !== null && rows.length < matching) {
    throw new Error(
      `Read only ${rows.length} of ${matching} ${what} rows for the month; refusing to report a partial total`,
    );
  }
  return rows;
}

/**
 * Every expense row in the window, optionally narrowed to a set of categories.
 * `id` is unique, which makes the sort a total order — see `fetchAllRows`.
 */
function fetchAllExpensesInRange(
  supabase: ServerClient,
  start: string,
  end: string,
  categoryIds?: string[],
): Promise<ExpenseRow[]> {
  return fetchAllRows<ExpenseRow>("expenses", (from, to) => {
    let query = supabase
      .from("transactions")
      .select("amount, category_id", { count: "exact" })
      .eq("type", "expense")
      .gte("occurred_at", start)
      .lte("occurred_at", end);
    if (categoryIds) query = query.in("category_id", categoryIds);
    return query
      .order("id", { ascending: true })
      .range(from, to)
      .returns<ExpenseRow[]>();
  });
}

/**
 * Whether last month's allotment for this budget can be trusted to equal the
 * amount sitting on the row today.
 *
 * `budgets` keeps ONE row per category with a single `amount` and no per-period
 * history (0001_init.sql:203-213), and `upsertBudget` overwrites it in place.
 * Today's amount therefore only stands in for last month's while the row has
 * not moved since the reported month began:
 *
 *   • created during or after the reported month → there was no allotment last
 *     month at all, so carrying one in invents a whole extra envelope. A brand
 *     new ₱5,000 budget with carry-over on would open the month with ₱10,000
 *     spendable and print "+₱5,000 carried over" as if it were fact.
 *   • edited since the month began → the amount now on the row may not be the
 *     one that was actually in force, so the leftover would be measured against
 *     a figure that never applied.
 *
 * Both cases carry nothing in: understating the envelope is recoverable, and
 * the user can see their real budget; fabricating one is not. `updated_at` is
 * maintained by the budgets_set_updated_at trigger, so an edit cannot slip past
 * this. Restoring the true figure for an edited budget needs per-period history
 * the schema does not keep.
 */
function carryoverBaselineKnown(budget: Budget, monthStart: string): boolean {
  const start = Date.parse(monthStart);
  const created = Date.parse(budget.created_at);
  const updated = Date.parse(budget.updated_at);
  // An unreadable timestamp is "unknown", never "fine".
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(created) ||
    !Number.isFinite(updated)
  ) {
    return false;
  }
  return created < start && updated < start;
}

/**
 * The month's spending in one pass: per budgeted category, and in total.
 *
 * The two figures have to come from the same read. Deriving the month's total
 * by summing the per-category rows is what let unbudgeted and uncategorised
 * spending vanish out of the headline numbers — the categories are a strict
 * subset of the ledger, so anything spent outside a budget simply wasn't there.
 */
async function getMonthlySpending(
  timezone: string,
  ref?: Date,
): Promise<{ items: BudgetWithSpending[]; totalSpent: number }> {
  const supabase = await createClient();
  const { start, end } = monthRange(timezone, ref);

  const [{ data: budgets }, { data: categories }, expenses] = await Promise.all([
    supabase.from("budgets").select("*").eq("active", true).returns<Budget[]>(),
    supabase.from("categories").select("*").returns<Category[]>(),
    fetchAllExpensesInRange(supabase, start, end),
  ]);

  const spentByCat = sumByCategory(expenses);
  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const catMap = new Map((categories ?? []).map((c) => [c.id, c]));

  // Carry-over: only fetch last month's spending when at least one budget opts
  // in (the column is falsy on a database without migration 0012) AND its
  // last-month allotment is actually knowable.
  const carryCats = (budgets ?? [])
    .filter((b) => b.carryover && carryoverBaselineKnown(b, start))
    .map((b) => b.category_id);
  const carrying = new Set(carryCats);
  let lastSpentByCat = new Map<string, number>();
  if (carryCats.length > 0) {
    // "Last month" is relative to the month being reported on, not to today —
    // otherwise a report for March would carry in February's leftover while
    // showing March's spending.
    const last = monthRange(timezone, subMonths(ref ?? new Date(), 1));
    lastSpentByCat = sumByCategory(
      await fetchAllExpensesInRange(supabase, last.start, last.end, carryCats),
    );
  }

  const items = (budgets ?? [])
    .map((budget) => {
      const spent = spentByCat.get(budget.category_id) ?? 0;
      const amount = Number(budget.amount);
      // Envelope-style: unspent rolls forward, overspend rolls forward too.
      // `lastAmount` is this row's amount only when the row demonstrably held
      // it all through last month — see carryoverBaselineKnown.
      const envelope = budgetEnvelope({
        amount,
        spent,
        lastAmount: carrying.has(budget.category_id) ? amount : null,
        lastSpent: lastSpentByCat.get(budget.category_id) ?? 0,
      });
      return {
        budget,
        category: catMap.get(budget.category_id) ?? null,
        spent,
        ...envelope,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  return { items, totalSpent };
}

/**
 * `ref` selects which month to report on — any instant inside it. Omitting it
 * keeps the original "current month" behaviour, so existing callers are
 * untouched.
 */
export async function getBudgetsWithSpending(
  timezone: string,
  ref?: Date,
): Promise<BudgetWithSpending[]> {
  return (await getMonthlySpending(timezone, ref)).items;
}

/**
 * First day of the `ref` month (the current month when `ref` is omitted) in the
 * user's timezone, as YYYY-MM-DD — the shape `monthly_budgets.period_start`
 * stores. Derived from `localDateKey`, so it agrees with `monthRange` about
 * which month a given instant belongs to.
 */
function periodStartKey(timezone: string, ref?: Date): string {
  return `${localDateKey(timezone, ref).slice(0, 7)}-01`;
}

/**
 * The overall monthly budget row for the `ref` month (current month when
 * omitted), or null if none set. Tolerates the table not existing yet
 * (migration 0011 not applied) so the budgets screen still renders on an
 * un-migrated database.
 */
export async function getMonthlyBudget(
  timezone: string,
  ref?: Date,
): Promise<MonthlyBudget | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select("*")
    .eq("period_start", periodStartKey(timezone, ref))
    .maybeSingle<MonthlyBudget>();
  // A missing table (migration 0011 not applied) degrades to "no budget set".
  if (error) return null;
  return data ?? null;
}

export type { BudgetRecommendation };

export type BudgetSummary = {
  hasMonthlyBudget: boolean;
  periodStart: string; // YYYY-MM-DD
  total: number; // overall monthly budget
  savingsTarget: number; // required savings allocation
  savingsFunded: number; // transfers into savings-type accounts this month
  categoryAllocated: number; // Σ active per-category budgets
  allocated: number; // categoryAllocated + savingsTarget
  expenseBudget: number; // total − savingsTarget: what expenses may use
  spent: number; // Σ ALL of the month's expenses, budgeted or not
  remaining: number; // expenseBudget − spent
  unallocated: number; // total − allocated (negative = over-allocated)
  overallPct: number; // spent / expenseBudget × 100 (0 when no expense budget)
  dayOfMonth: number;
  daysInMonth: number;
  daysLeft: number;
  items: BudgetWithSpending[];
  recommendations: BudgetRecommendation[];
};

/**
 * The complete monthly-budget picture in one call: the overall budget, the
 * per-category allotments with spending, the derived allocation totals, and
 * rule-based recommendations. All money is summed from exact numeric columns.
 */
export async function getBudgetSummary(
  timezone: string,
  currency = "PHP",
  ref?: Date,
): Promise<BudgetSummary> {
  const [monthly, spending, savingsFunded] = await Promise.all([
    getMonthlyBudget(timezone, ref),
    getMonthlySpending(timezone, ref),
    getSavingsFundedInMonth(timezone, ref),
  ]);

  const items = spending.items;
  const total = monthly ? Number(monthly.total_amount) : 0;
  const savingsTarget = monthly ? Number(monthly.savings_target) : 0;
  const categoryAllocated = items.reduce(
    (sum, i) => sum + Number(i.budget.amount),
    0,
  );
  // Every expense in the month, not just the ones inside a budgeted category:
  // the figures below are measured against whole-month budgets, so a narrower
  // numerator would leave unbudgeted spending out of the comparison entirely.
  const spent = spending.totalSpent;

  // The savings target is a commitment, not spending money — see
  // monthlyBudgetTotals for why it is subtracted rather than added.
  const { expenseBudget, allocated, unallocated, remaining, overallPct } =
    monthlyBudgetTotals({ total, savingsTarget, categoryAllocated, spent });

  const { dayOfMonth, daysInMonth, daysLeft } = monthDayInfo(timezone, ref);

  const summary: Omit<BudgetSummary, "recommendations"> = {
    hasMonthlyBudget: Boolean(monthly) && total > 0,
    periodStart: monthly?.period_start ?? periodStartKey(timezone, ref),
    total,
    savingsTarget,
    savingsFunded,
    categoryAllocated,
    allocated,
    expenseBudget,
    spent,
    remaining,
    unallocated,
    overallPct,
    dayOfMonth,
    daysInMonth,
    daysLeft,
    items,
  };

  return {
    ...summary,
    recommendations: buildBudgetRecommendations(summary, currency),
  };
}

/**
 * Rule-based budget guidance derived purely from the summary — no ML, no
 * fabricated figures. Warnings first, capped so the list stays scannable.
 *
 * The rules themselves live in `@/lib/budget-advice`, which is pure and
 * dependency-free so it can be unit-tested; this wrapper just narrows the
 * database-shaped summary down to what those rules read.
 */
export function buildBudgetRecommendations(
  s: Omit<BudgetSummary, "recommendations">,
  currency = "PHP",
): BudgetRecommendation[] {
  return buildAdvice(
    {
      hasMonthlyBudget: s.hasMonthlyBudget,
      total: s.total,
      savingsTarget: s.savingsTarget,
      savingsFunded: s.savingsFunded,
      spent: s.spent,
      unallocated: s.unallocated,
      dayOfMonth: s.dayOfMonth,
      daysInMonth: s.daysInMonth,
      daysLeft: s.daysLeft,
      items: s.items.map((i) => ({
        name: i.category?.name ?? null,
        amount: Number(i.budget.amount),
        spent: i.spent,
        remaining: i.remaining,
        pct: i.pct,
      })),
    },
    currencySymbol(currency),
  );
}

/**
 * Day-of-month position in the user's timezone, for the `ref` month (the
 * current month when omitted).
 *
 * A month other than the current one has no "today" in it, so its pacing has to
 * be pinned to an edge: a closed month is fully spent (0 days left) and a future
 * one hasn't started. Reporting "day 15 of 31" for a month that ended in March
 * would have the advice engine warn about a pace nobody can still change.
 */
function monthDayInfo(timezone: string, ref?: Date) {
  const todayKey = localDateKey(timezone);
  const monthKey = localDateKey(timezone, ref).slice(0, 7);
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)); // 1–12
  const daysInMonth = new Date(year, month, 0).getDate();
  // "YYYY-MM" sorts lexicographically in chronological order.
  const dayOfMonth =
    monthKey === todayKey.slice(0, 7)
      ? Number(todayKey.slice(8, 10))
      : monthKey < todayKey.slice(0, 7)
        ? daysInMonth
        : 0;
  return { dayOfMonth, daysInMonth, daysLeft: Math.max(0, daysInMonth - dayOfMonth) };
}

/**
 * How much was actually moved to savings in the `ref` month (current month when
 * omitted): the sum of transfers whose destination is a savings-type account.
 * Real ledger data, not a guess.
 *
 * Both reads throw rather than falling back to 0. A swallowed error here is not
 * a blank line — it is the positive claim "₱0 funded" printed beside the
 * target, with an empty progress bar and advice text to match, which invites
 * the person to transfer money they have already transferred. Nothing about a
 * failed query is distinguishable from a genuinely unfunded month once it has
 * collapsed to zero.
 */
async function getSavingsFundedInMonth(
  timezone: string,
  ref?: Date,
): Promise<number> {
  const supabase = await createClient();
  const { data: savingsAccounts, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("type", "savings")
    .eq("archived", false)
    .returns<Pick<Account, "id">[]>();
  if (error) {
    throw new Error(`Failed to load savings accounts: ${error.message}`);
  }
  const ids = (savingsAccounts ?? []).map((a) => a.id);
  if (ids.length === 0) return 0;

  const { start, end } = monthRange(timezone, ref);
  const transfers = await fetchAllRows<Pick<Transaction, "amount">>(
    "savings transfers",
    (from, to) =>
      supabase
        .from("transactions")
        .select("amount", { count: "exact" })
        .eq("type", "transfer")
        .in("to_account_id", ids)
        .gte("occurred_at", start)
        .lte("occurred_at", end)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<Pick<Transaction, "amount">[]>(),
  );
  return transfers.reduce((s, t) => s + Number(t.amount), 0);
}

/* -------------------------------------------------------------------------- */
/*  Monthly budget vs. actual                                                  */
/* -------------------------------------------------------------------------- */

/**
 * "YYYY-MM" → an instant guaranteed to land inside that month in every
 * timezone. Midday on the 15th is at least twelve hours clear of both month
 * boundaries, so shifting it by any real UTC offset (−12 … +14) still reads as
 * the same month once `monthRange` re-zones it into the user's calendar.
 *
 * A malformed key returns undefined, which every caller reads as "current
 * month". `?month=` is a hand-editable search param, and a report for the wrong
 * month is a far better answer to a typo than a 500.
 */
function monthKeyToRef(monthKey?: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey ?? "");
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  // Date.UTC folds years 0–99 onto 1900–1999, so "0023-04" would quietly become
  // April 1923. Reject the range instead of reporting on a century-old month.
  if (year < 1000 || month < 1 || month > 12) return undefined;
  return new Date(Date.UTC(year, month - 1, 15, 12));
}

/**
 * The month's budget-vs-actual report: every active category budget against
 * what was actually spent, with everything that fell outside a budget (and
 * everything uncategorised) collected into a single Unbudgeted bucket so no
 * peso goes missing between the rows and the totals.
 *
 * `monthKey` is "YYYY-MM"; omit it for the current month in the user's
 * timezone. Only `type='expense'` rows count, so savings transfers, income and
 * balance adjustments are excluded by construction — and unpaid upcoming bills
 * aren't transactions at all, so they never inflate "actual".
 *
 * Every figure it returns is derived by `@/lib/budget-report`, which is pure
 * and unit-tested; this function's whole job is gathering the rows.
 */
export async function getMonthlyBudgetReport(
  timezone: string,
  monthKey?: string,
): Promise<BudgetReport> {
  const supabase = await createClient();
  const ref = monthKeyToRef(monthKey);
  const { start, end } = monthRange(timezone, ref);

  const [budgetsRes, categoriesRes, expenses, monthly, savingsFunded] =
    await Promise.all([
      supabase.from("budgets").select("*").eq("active", true).returns<Budget[]>(),
      supabase.from("categories").select("*").returns<Category[]>(),
      fetchAllExpensesInRange(supabase, start, end),
      // Deliberately lenient, and ONLY this one: it already degrades a missing
      // table (migration 0011 not applied) to "no budget set", and an absent
      // savings target blanks the savings line entirely rather than claiming a
      // figure. It can't fake spending. Its neighbour below is not lenient —
      // a zero funded amount beside a real target IS a claim.
      getMonthlyBudget(timezone, ref),
      getSavingsFundedInMonth(timezone, ref),
    ]);

  // Swallowing these would render as a tidy "₱0 spent, comfortably within
  // budget" — a lie that reads like good news. Fail loudly instead.
  if (budgetsRes.error) {
    throw new Error(`Failed to load budgets: ${budgetsRes.error.message}`);
  }
  if (categoriesRes.error) {
    throw new Error(`Failed to load categories: ${categoriesRes.error.message}`);
  }

  const catMap = new Map((categoriesRes.data ?? []).map((c) => [c.id, c]));

  const budgets = (budgetsRes.data ?? []).map((b) => ({
    categoryId: b.category_id,
    // The FK cascades on category delete, so a nameless budget shouldn't exist;
    // this is a label of last resort so a row can never render blank.
    categoryName: catMap.get(b.category_id)?.name ?? "Unknown category",
    amount: Number(b.amount),
  }));

  // Collapse the ledger to one row per category before it leaves this module —
  // the report takes totals, not transactions. Uncategorised expenses need a
  // key of their own because Map can't distinguish two nulls from one; category
  // ids are uuids, so this word can never collide with a real one.
  const UNCATEGORISED = "uncategorised";
  const totals = new Map<string, number>();
  for (const row of expenses) {
    const key = row.category_id ?? UNCATEGORISED;
    totals.set(key, (totals.get(key) ?? 0) + Number(row.amount));
  }

  const actualByCategory = [...totals].map(([key, amount]) => {
    const categoryId = key === UNCATEGORISED ? null : key;
    return {
      categoryId,
      categoryName: categoryId ? (catMap.get(categoryId)?.name ?? null) : null,
      amount,
    };
  });

  return buildBudgetReport({
    budgets,
    actualByCategory,
    savingsTarget: monthly ? Number(monthly.savings_target) : 0,
    savingsFunded,
  });
}

export type UpcomingBill = {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  daysUntil: number; // negative = overdue
};

export type CashFlowForecast = {
  spendable: number; // current balance across spending accounts
  monthSpentSoFar: number;
  upcomingBills: UpcomingBill[]; // active bills due on/before month-end (incl. overdue)
  upcomingBillsTotal: number;
  paceProjectedSpend: number; // remaining spend if the month's pace continues
  projectedRemainingSpend: number; // max(known bills, pace) — never double-counts
  projectedEndBalance: number; // spendable − projectedRemainingSpend
  dayOfMonth: number;
  daysInMonth: number;
  daysLeft: number;
};

/**
 * Rest-of-month cash-flow estimate from real data: spending-account balances,
 * the bills still due this month, and the month's spending pace. Recurring
 * income isn't modelled, so this is a conservative floor — labelled as such.
 */
export async function getCashFlowForecast(
  timezone: string,
): Promise<CashFlowForecast> {
  const supabase = await createClient();
  const { start, end } = monthRange(timezone);
  const { dayOfMonth, daysInMonth, daysLeft } = monthDayInfo(timezone);

  const [accounts, bills, expenses] = await Promise.all([
    getAccountsWithBalances(false),
    getBills(timezone, true),
    // Paged, not a plain select: a truncated month would under-report the pace
    // and forecast a healthier end-of-month balance than the ledger supports.
    fetchAllExpensesInRange(supabase, start, end),
  ]);

  const spendable = accounts
    .filter((a) => a.is_spending)
    .reduce((s, a) => s + Number(a.balance), 0);
  const monthSpentSoFar = expenses.reduce((s, t) => s + Number(t.amount), 0);

  const upcomingBills: UpcomingBill[] = bills
    .filter((b) => b.daysUntilDue <= daysLeft)
    .map((b) => ({
      id: b.bill.id,
      name: b.bill.name,
      amount: Number(b.bill.amount),
      dueDate: b.bill.next_due_date,
      daysUntil: b.daysUntilDue,
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const upcomingBillsTotal = upcomingBills.reduce((s, b) => s + b.amount, 0);

  const paceProjectedSpend =
    dayOfMonth > 0 ? (monthSpentSoFar / dayOfMonth) * daysLeft : 0;
  const projectedRemainingSpend = Math.max(upcomingBillsTotal, paceProjectedSpend);

  return {
    spendable,
    monthSpentSoFar,
    upcomingBills,
    upcomingBillsTotal,
    paceProjectedSpend,
    projectedRemainingSpend,
    projectedEndBalance: spendable - projectedRemainingSpend,
    dayOfMonth,
    daysInMonth,
    daysLeft,
  };
}

export type BillStatus = "overdue" | "due_soon" | "upcoming";

export type BillWithStatus = {
  bill: Bill;
  category: Category | null;
  status: BillStatus;
  daysUntilDue: number;
  lastPaidDate: string | null;
};

export async function getBills(
  timezone: string,
  activeOnly = true,
): Promise<BillWithStatus[]> {
  const supabase = await createClient();
  const todayKey = localDateKey(timezone);

  let billQuery = supabase
    .from("bills")
    .select("*")
    .order("next_due_date", { ascending: true });
  if (activeOnly) billQuery = billQuery.eq("active", true);

  const [{ data: bills }, { data: categories }, { data: payments }] =
    await Promise.all([
      billQuery.returns<Bill[]>(),
      supabase.from("categories").select("*").returns<Category[]>(),
      supabase
        .from("bill_payments")
        .select("bill_id, paid_for_date")
        .order("paid_for_date", { ascending: false })
        .returns<{ bill_id: string; paid_for_date: string }[]>(),
    ]);

  const catMap = new Map((categories ?? []).map((c) => [c.id, c]));
  const lastPaid = new Map<string, string>();
  for (const p of payments ?? []) {
    if (!lastPaid.has(p.bill_id)) lastPaid.set(p.bill_id, p.paid_for_date);
  }

  return (bills ?? []).map((bill) => {
    const days = differenceInCalendarDays(
      new Date(bill.next_due_date),
      new Date(todayKey),
    );
    const status: BillStatus =
      days < 0 ? "overdue" : days <= bill.remind_days_before ? "due_soon" : "upcoming";
    return {
      bill,
      category: bill.category_id ? (catMap.get(bill.category_id) ?? null) : null,
      status,
      daysUntilDue: days,
      lastPaidDate: lastPaid.get(bill.id) ?? null,
    };
  });
}

/** The soonest active bill for the dashboard summary. */
export async function getNextBill(
  timezone: string,
): Promise<BillWithStatus | null> {
  const bills = await getBills(timezone, true);
  return bills[0] ?? null;
}

/**
 * Count of bills due within their reminder window (for the tab badge).
 * Kept deliberately lightweight — it runs on every authed page render, so it
 * fetches only the two columns it needs (no category/payment joins).
 */
export async function getDueBillCount(timezone: string): Promise<number> {
  const supabase = await createClient();
  const todayKey = localDateKey(timezone);
  const { data } = await supabase
    .from("bills")
    .select("next_due_date, remind_days_before")
    .eq("active", true)
    .returns<Pick<Bill, "next_due_date" | "remind_days_before">[]>();

  return (data ?? []).filter((b) => {
    const days = differenceInCalendarDays(
      new Date(b.next_due_date),
      new Date(todayKey),
    );
    return days <= b.remind_days_before; // overdue or due-soon
  }).length;
}
