import { addMonths, addWeeks, addYears, format } from "date-fns";
import { localDateKey } from "@/lib/date";
import { daysInMonthKey, shiftMonthStart } from "@/lib/month";

/** Money calculations use cents to avoid fractional-cent drift. */
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** The balance view includes future-dated entries; undo them for today's snapshot. */
export function spendingCashNow(
  accounts: { id: string; is_spending: boolean; balance: number }[],
  future: { type: string; amount: number; account_id: string; to_account_id: string | null; direction: string | null }[],
) {
  const ids = new Set(accounts.filter(a => a.is_spending).map(a => a.id));
  let value = accounts.filter(a => a.is_spending).reduce((s,a)=>s+Number(a.balance),0);
  for (const tx of future) {
    const amount = Number(tx.amount);
    if (ids.has(tx.account_id)) {
      const outgoing = tx.type === "expense" || tx.type === "transfer" || (tx.type === "adjustment" && tx.direction === "out");
      value += outgoing ? amount : -amount;
    }
    if (tx.type === "transfer" && tx.to_account_id && ids.has(tx.to_account_id)) value -= amount;
  }
  return roundMoney(value);
}

export function forecastExpense(spent: number, month: string, today: string): number {
  const current = `${today.slice(0, 7)}-01`;
  if (month > current) return 0;
  const days = daysInMonthKey(month);
  const elapsed = month === current ? Number(today.slice(8, 10)) : days;
  return roundMoney((spent / Math.max(1, elapsed)) * days);
}

type Allotment = { category_id: string; month_start: string; amount: number };
type Expense = { category_id: string | null; occurred_at: string; amount: number };

/** Carry is cumulative across consecutive closed months, never a future promise. */
export function categoryCarryovers(
  budgets: Allotment[],
  plans: { month_start: string; carry_over_enabled: boolean }[],
  expenses: Expense[],
  targetMonth: string,
  timezone: string,
  today: string,
): Map<string, number> {
  const current = `${today.slice(0, 7)}-01`;
  if (targetMonth > current) return new Map();
  const enabled = new Set(plans.filter(p => p.carry_over_enabled).map(p => p.month_start));
  const spent = new Map<string, number>();
  for (const expense of expenses) {
    const month = `${localDateKey(timezone, new Date(expense.occurred_at)).slice(0, 7)}-01`;
    const key = `${month}:${expense.category_id}`;
    spent.set(key, roundMoney((spent.get(key) ?? 0) + Number(expense.amount)));
  }
  const previous = new Map<string, { month: string; remaining: number }>();
  const result = new Map<string, number>();
  for (const budget of [...budgets].sort((a, b) => a.month_start.localeCompare(b.month_start))) {
    if (budget.month_start > targetMonth) continue;
    const last = previous.get(budget.category_id);
    const carry = enabled.has(budget.month_start) && last?.month === shiftMonthStart(budget.month_start, -1)
      ? Math.max(last.remaining, 0) : 0;
    if (budget.month_start === targetMonth) result.set(budget.category_id, carry);
    previous.set(budget.category_id, {
      month: budget.month_start,
      remaining: roundMoney(Number(budget.amount) + carry - (spent.get(`${budget.month_start}:${budget.category_id}`) ?? 0)),
    });
  }
  return result;
}

type ScheduledBill = {
  id: string; amount: number; next_due_date: string;
  frequency: "once" | "weekly" | "monthly" | "yearly";
};

/** Expand every unpaid occurrence, including overdue dates and weekly repeats. */
export function billsDueThrough(
  bills: ScheduledBill[],
  paid: { bill_id: string; paid_for_date: string }[],
  through: string,
): number {
  const paidKeys = new Set(paid.map(p => `${p.bill_id}:${p.paid_for_date}`));
  let total = 0;
  for (const bill of bills) {
    const anchor = new Date(`${bill.next_due_date}T12:00:00`);
    let due = bill.next_due_date;
    for (let occurrence = 0; due <= through; occurrence++) {
      if (!paidKeys.has(`${bill.id}:${due}`)) total = roundMoney(total + Number(bill.amount));
      if (bill.frequency === "once") break;
      const next = bill.frequency === "weekly" ? addWeeks(anchor, occurrence + 1)
        : bill.frequency === "yearly" ? addYears(anchor, occurrence + 1)
          : addMonths(anchor, occurrence + 1);
      due = format(next, "yyyy-MM-dd");
      if (occurrence >= 10000) throw new Error("Bill schedule is too old to forecast. Update its next due date.");
    }
  }
  return total;
}

export function budgetTotals(input: {
  totalBudget: number; expenseAllocated: number; savingsAllocated: number;
  carryover: number; spent: number; contributions: { amount: number }[];
}) {
  const savedThisMonth = roundMoney(input.contributions.reduce((sum, c) => sum + Number(c.amount), 0));
  const allocated = roundMoney(input.expenseAllocated + input.savingsAllocated);
  return {
    savedThisMonth, allocated,
    unallocated: roundMoney(input.totalBudget - allocated),
    remaining: roundMoney(input.totalBudget + input.carryover - input.spent - savedThisMonth),
    spendingCeiling: roundMoney(Math.max(0, input.totalBudget + input.carryover - Math.max(input.savingsAllocated, savedThisMonth))),
  };
}
