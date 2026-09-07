import { differenceInCalendarDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/date";
import { categoryCarryovers, forecastExpense, roundMoney } from "@/lib/budget-math";
import { allRows } from "@/lib/queries/all-rows";
import {
  currentMonthStart,
  monthDateRange,
} from "@/lib/month";
import type {
  Bill,
  Budget,
  Category,
  MonthlyBudgetPlan,
  Transaction,
} from "@/lib/supabase/types";

export type BudgetWithSpending = {
  budget: Budget;
  category: Category | null;
  spent: number;
  baseAmount: number;
  carryover: number;
  effectiveAmount: number;
  remaining: number;
  pct: number; // 0–100+ (uncapped)
  forecastSpent: number;
  forecastRemaining: number;
};

export async function getBudgetsWithSpending(
  timezone: string,
  selectedMonth?: string,
): Promise<BudgetWithSpending[]> {
  const supabase = await createClient();
  const monthStart = selectedMonth ?? currentMonthStart(timezone);
  const now = new Date();
  const range = monthDateRange(timezone, monthStart);
  const through = new Date(Math.min(now.getTime(), Date.parse(range.end))).toISOString();
  const [budgets, plans, categories] = await Promise.all([
    allRows<Budget>((from, to) => supabase.from("monthly_category_budgets")
      .select("*").eq("active", true).lte("month_start", monthStart)
      .order("month_start").order("id").range(from, to).returns<Budget[]>()),
    allRows<MonthlyBudgetPlan>((from, to) => supabase.from("monthly_budget_plans")
      .select("*").lte("month_start", monthStart).order("month_start")
      .range(from, to).returns<MonthlyBudgetPlan[]>()),
    allRows<Category>((from, to) => supabase.from("categories").select("*")
      .order("id").range(from, to).returns<Category[]>()),
  ]);
  const earliest = budgets[0]?.month_start ?? monthStart;
  const expenses = await allRows<Pick<Transaction, "amount" | "category_id" | "occurred_at">>(
    (from, to) => supabase.from("transactions").select("amount, category_id, occurred_at")
      .eq("type", "expense").gte("occurred_at", monthDateRange(timezone, earliest).start)
      .lte("occurred_at", through).order("occurred_at").order("id").range(from, to),
  );
  const carryovers = categoryCarryovers(budgets, plans, expenses, monthStart, timezone, localDateKey(timezone, now));
  const spentByCategory = new Map<string, number>();
  for (const expense of expenses) {
    if (!expense.category_id || Date.parse(expense.occurred_at) < Date.parse(range.start)) continue;
    spentByCategory.set(expense.category_id, roundMoney((spentByCategory.get(expense.category_id) ?? 0) + Number(expense.amount)));
  }
  const categoryMap = new Map(categories.map(category => [category.id, category]));
  return budgets.filter(budget => budget.month_start === monthStart).map(budget => {
    const spent = spentByCategory.get(budget.category_id) ?? 0;
    const baseAmount = Number(budget.amount);
    const carryover = carryovers.get(budget.category_id) ?? 0;
    const effectiveAmount = roundMoney(baseAmount + carryover);
    const projected = forecastExpense(spent, monthStart, localDateKey(timezone, now));
    return {
      budget, category: categoryMap.get(budget.category_id) ?? null,
      spent, baseAmount, carryover, effectiveAmount,
      remaining: roundMoney(effectiveAmount - spent),
      pct: effectiveAmount > 0 ? spent / effectiveAmount * 100 : 0,
      forecastSpent: projected,
      forecastRemaining: roundMoney(effectiveAmount - projected),
    };
  }).sort((a, b) => b.pct - a.pct);
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
