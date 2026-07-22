import { differenceInCalendarDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { monthRange, localDateKey } from "@/lib/date";
import type {
  Bill,
  Budget,
  Category,
  Transaction,
} from "@/lib/supabase/types";

export type BudgetWithSpending = {
  budget: Budget;
  category: Category | null;
  spent: number;
  remaining: number;
  pct: number; // 0–100+ (uncapped)
};

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

  const spentByCat = new Map<string, number>();
  for (const e of expenses ?? []) {
    if (!e.category_id) continue;
    spentByCat.set(
      e.category_id,
      (spentByCat.get(e.category_id) ?? 0) + Number(e.amount),
    );
  }
  const catMap = new Map((categories ?? []).map((c) => [c.id, c]));

  return (budgets ?? [])
    .map((budget) => {
      const spent = spentByCat.get(budget.category_id) ?? 0;
      const amount = Number(budget.amount);
      return {
        budget,
        category: catMap.get(budget.category_id) ?? null,
        spent,
        remaining: amount - spent,
        pct: amount > 0 ? (spent / amount) * 100 : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct);
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
