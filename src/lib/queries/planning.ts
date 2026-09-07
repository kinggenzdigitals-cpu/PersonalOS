import { differenceInCalendarDays, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { monthRange, localDateKey } from "@/lib/date";
import { currencySymbol } from "@/lib/format";
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
  pct: number; // spent / effective × 100 (uncapped)
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

export async function getBudgetsWithSpending(
  timezone: string,
): Promise<BudgetWithSpending[]> {
  const supabase = await createClient();
  const { start, end } = monthRange(timezone);

  const [{ data: budgets }, { data: categories }, { data: expenses }] =
    await Promise.all([
      supabase
        .from("budgets")
        .select("*")
        .eq("active", true)
        .returns<Budget[]>(),
      supabase.from("categories").select("*").returns<Category[]>(),
      supabase
        .from("transactions")
        .select("amount, category_id")
        .eq("type", "expense")
        .gte("occurred_at", start)
        .lte("occurred_at", end)
        .returns<Pick<Transaction, "amount" | "category_id">[]>(),
    ]);

  const spentByCat = sumByCategory(expenses);
  const catMap = new Map((categories ?? []).map((c) => [c.id, c]));

  // Carry-over: only fetch last month's spending when at least one budget
  // opts in (the column is falsy on a database without migration 0012).
  const carryCats = (budgets ?? [])
    .filter((b) => b.carryover)
    .map((b) => b.category_id);
  let lastSpentByCat = new Map<string, number>();
  if (carryCats.length > 0) {
    const last = monthRange(timezone, subMonths(new Date(), 1));
    const { data: lastExpenses } = await supabase
      .from("transactions")
      .select("amount, category_id")
      .eq("type", "expense")
      .in("category_id", carryCats)
      .gte("occurred_at", last.start)
      .lte("occurred_at", last.end)
      .returns<Pick<Transaction, "amount" | "category_id">[]>();
    lastSpentByCat = sumByCategory(lastExpenses);
  }

  return (budgets ?? [])
    .map((budget) => {
      const spent = spentByCat.get(budget.category_id) ?? 0;
      const amount = Number(budget.amount);
      // Envelope-style: unspent rolls forward, overspend rolls forward too.
      const carryIn = budget.carryover
        ? amount - (lastSpentByCat.get(budget.category_id) ?? 0)
        : 0;
      const effective = amount + carryIn;
      return {
        budget,
        category: catMap.get(budget.category_id) ?? null,
        spent,
        carryIn,
        effective,
        remaining: effective - spent,
        pct: effective > 0 ? (spent / effective) * 100 : spent > 0 ? 100 : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

/** First day of the current month in the user's timezone, as YYYY-MM-DD. */
function currentPeriodStart(timezone: string): string {
  return `${localDateKey(timezone).slice(0, 7)}-01`;
}

/**
 * The overall monthly budget row for the current month, or null if none set.
 * Tolerates the table not existing yet (migration 0011 not applied) so the
 * budgets screen still renders on an un-migrated database.
 */
export async function getMonthlyBudget(
  timezone: string,
): Promise<MonthlyBudget | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select("*")
    .eq("period_start", currentPeriodStart(timezone))
    .maybeSingle<MonthlyBudget>();
  // A missing table (migration 0011 not applied) degrades to "no budget set".
  if (error) return null;
  return data ?? null;
}

export type BudgetRecommendation = {
  tone: "warn" | "info" | "success";
  text: string;
};

export type BudgetSummary = {
  hasMonthlyBudget: boolean;
  periodStart: string; // YYYY-MM-DD
  total: number; // overall monthly budget
  savingsTarget: number; // required savings allocation
  savingsFunded: number; // transfers into savings-type accounts this month
  categoryAllocated: number; // Σ active per-category budgets
  allocated: number; // categoryAllocated + savingsTarget
  spent: number; // Σ spent across budgeted categories
  remaining: number; // allocated − spent
  unallocated: number; // total − allocated (negative = over-allocated)
  overallPct: number; // spent / total × 100 (0 when no total)
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
): Promise<BudgetSummary> {
  const [monthly, items, savingsFunded] = await Promise.all([
    getMonthlyBudget(timezone),
    getBudgetsWithSpending(timezone),
    getSavingsFundedThisMonth(timezone),
  ]);

  const total = monthly ? Number(monthly.total_amount) : 0;
  const savingsTarget = monthly ? Number(monthly.savings_target) : 0;
  const categoryAllocated = items.reduce(
    (sum, i) => sum + Number(i.budget.amount),
    0,
  );
  const allocated = categoryAllocated + savingsTarget;
  const spent = items.reduce((sum, i) => sum + i.spent, 0);
  const remaining = allocated - spent;
  const unallocated = total - allocated;
  const overallPct = total > 0 ? (spent / total) * 100 : 0;

  const { dayOfMonth, daysInMonth, daysLeft } = monthDayInfo(timezone);

  const summary: Omit<BudgetSummary, "recommendations"> = {
    hasMonthlyBudget: Boolean(monthly) && total > 0,
    periodStart: monthly?.period_start ?? currentPeriodStart(timezone),
    total,
    savingsTarget,
    savingsFunded,
    categoryAllocated,
    allocated,
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

/** Money inside recommendation text, so <MaskAmounts> can hide it on demand. */
function money(n: number, sym: string): string {
  return `${sym}${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

/**
 * Rule-based budget guidance derived purely from the summary — no ML, no
 * fabricated figures. Warnings first, capped so the list stays scannable.
 */
export function buildBudgetRecommendations(
  s: Omit<BudgetSummary, "recommendations">,
  currency = "PHP",
): BudgetRecommendation[] {
  if (!s.hasMonthlyBudget) return [];
  const sym = currencySymbol(currency);
  const m = (n: number) => money(n, sym);

  const warn: BudgetRecommendation[] = [];
  const info: BudgetRecommendation[] = [];

  // Allocation coverage.
  if (s.unallocated > 0.5) {
    info.push({
      tone: "info",
      text: `You have ${m(s.unallocated)} left to allocate.`,
    });
  } else if (s.unallocated < -0.5) {
    warn.push({
      tone: "warn",
      text: `You've over-allocated by ${m(s.unallocated)}. Trim a category or raise your budget.`,
    });
  }

  // Over-total spending.
  if (s.spent > s.total + 0.5) {
    warn.push({
      tone: "warn",
      text: `You've spent ${m(s.spent)} — more than your ${m(s.total)} budget this month.`,
    });
  }

  // Per-category: over budget, then near limit.
  for (const i of s.items) {
    const name = i.category?.name ?? "A category";
    const amount = Number(i.budget.amount);
    if (i.pct > 100) {
      warn.push({ tone: "warn", text: `${name} is over by ${m(-i.remaining)}.` });
    } else if (i.pct >= 80 && s.daysLeft > 0) {
      warn.push({
        tone: "warn",
        text: `${name} is at ${Math.round(i.pct)}% with ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left.`,
      });
    } else if (i.spent > 0 && s.dayOfMonth >= 5) {
      // Pace-based month-end forecast (labelled as an estimate).
      const projected = (i.spent / s.dayOfMonth) * s.daysInMonth;
      if (projected > amount * 1.05) {
        info.push({
          tone: "info",
          text: `At this pace ${name} is on track for about ${m(projected)} by month-end (budget ${m(amount)}).`,
        });
      }
    }
  }

  // Savings: funded = transfers into savings-type accounts this month.
  if (s.savingsTarget > 0) {
    const gap = s.savingsTarget - s.savingsFunded;
    if (gap <= 0.5) {
      info.push({
        tone: "success",
        text: `Savings funded: ${m(s.savingsFunded)} moved to savings this month.`,
      });
    } else if (s.daysLeft <= 5) {
      warn.push({
        tone: "warn",
        text: `${m(gap)} of your savings allocation is still unfunded with ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left.`,
      });
    } else {
      info.push({
        tone: "info",
        text: `Savings: ${m(s.savingsFunded)} of ${m(s.savingsTarget)} moved so far — ${m(gap)} to go.`,
      });
    }
  }

  // Warnings first; cap to keep the card scannable.
  return [...warn, ...info].slice(0, 6);
}

/** Day-of-month position in the user's timezone. */
function monthDayInfo(timezone: string) {
  const todayKey = localDateKey(timezone);
  const year = Number(todayKey.slice(0, 4));
  const month = Number(todayKey.slice(5, 7)); // 1–12
  const dayOfMonth = Number(todayKey.slice(8, 10));
  const daysInMonth = new Date(year, month, 0).getDate();
  return { dayOfMonth, daysInMonth, daysLeft: Math.max(0, daysInMonth - dayOfMonth) };
}

/**
 * How much was actually moved to savings this month: the sum of transfers
 * whose destination is a savings-type account. Real ledger data, not a guess.
 */
async function getSavingsFundedThisMonth(timezone: string): Promise<number> {
  const supabase = await createClient();
  const { data: savingsAccounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("type", "savings")
    .eq("archived", false)
    .returns<Pick<Account, "id">[]>();
  const ids = (savingsAccounts ?? []).map((a) => a.id);
  if (ids.length === 0) return 0;

  const { start, end } = monthRange(timezone);
  const { data } = await supabase
    .from("transactions")
    .select("amount")
    .eq("type", "transfer")
    .in("to_account_id", ids)
    .gte("occurred_at", start)
    .lte("occurred_at", end)
    .returns<Pick<Transaction, "amount">[]>();
  return (data ?? []).reduce((s, t) => s + Number(t.amount), 0);
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

  const [accounts, bills, { data: expenses }] = await Promise.all([
    getAccountsWithBalances(false),
    getBills(timezone, true),
    supabase
      .from("transactions")
      .select("amount")
      .eq("type", "expense")
      .gte("occurred_at", start)
      .lte("occurred_at", end)
      .returns<Pick<Transaction, "amount">[]>(),
  ]);

  const spendable = accounts
    .filter((a) => a.is_spending)
    .reduce((s, a) => s + Number(a.balance), 0);
  const monthSpentSoFar = (expenses ?? []).reduce(
    (s, t) => s + Number(t.amount),
    0,
  );

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
