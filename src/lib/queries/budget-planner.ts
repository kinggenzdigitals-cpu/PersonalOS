import { toZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import {
  currentMonthStart,
  daysInMonthKey,
  monthDateRange,
  monthLabel,
} from "@/lib/month";
import { getBudgetsWithSpending } from "@/lib/queries/planning";
import type {
  AccountBalance,
  Bill,
  MonthlyBudgetPlan,
  MonthlyGoalAllocation,
  SavingsGoal,
  SavingsGoalContribution,
  Transaction,
} from "@/lib/supabase/types";

export type SavingsAllocationWithProgress = {
  allocation: MonthlyGoalAllocation;
  goal: SavingsGoal | null;
  savedThisMonth: number;
  pct: number;
};

export type BudgetRecommendation = {
  level: "info" | "warning" | "error";
  title: string;
  detail: string;
};

export type MonthlyBudgetPlanner = {
  monthStart: string;
  label: string;
  isCurrentMonth: boolean;
  isPastMonth: boolean;
  plan: MonthlyBudgetPlan | null;
  budgets: Awaited<ReturnType<typeof getBudgetsWithSpending>>;
  goals: SavingsGoal[];
  savings: SavingsAllocationWithProgress[];
  summary: {
    totalBudget: number;
    expenseAllocated: number;
    savingsAllocated: number;
    allocated: number;
    carryover: number;
    spent: number;
    savedThisMonth: number;
    remaining: number;
    unallocated: number;
  };
  forecast: {
    expense: number;
    spendingCeiling: number;
    remaining: number;
    projectedOver: number;
  };
  cashFlow: {
    availableNow: number;
    expectedIncome: number;
    incomeReceived: number;
    expectedIncomeLeft: number;
    upcomingBills: number;
    projectedAvailable: number;
  };
  recommendations: BudgetRecommendation[];
};

export async function getMonthlyBudgetPlanner(
  timezone: string,
  monthStart: string,
  currency = "PHP",
): Promise<MonthlyBudgetPlanner> {
  const supabase = await createClient();
  const range = monthDateRange(timezone, monthStart);
  const currentKey = currentMonthStart(timezone);
  const isCurrentMonth = monthStart === currentKey;
  const isPastMonth = monthStart < currentKey;

  const [
    budgets,
    { data: plan },
    { data: allocations },
    { data: goals },
    { data: contributions },
    { data: transactions },
    { data: accounts },
    { data: activeBills },
  ] = await Promise.all([
    getBudgetsWithSpending(timezone, monthStart),
    supabase
      .from("monthly_budget_plans")
      .select("*")
      .eq("month_start", monthStart)
      .maybeSingle<MonthlyBudgetPlan>(),
    supabase
      .from("monthly_goal_allocations")
      .select("*")
      .eq("month_start", monthStart)
      .order("created_at")
      .returns<MonthlyGoalAllocation[]>(),
    supabase
      .from("savings_goals")
      .select("*")
      .order("sort_order")
      .order("created_at")
      .returns<SavingsGoal[]>(),
    supabase
      .from("savings_goal_contributions")
      .select("*")
      .gte("contributed_at", range.start)
      .lte("contributed_at", range.end)
      .returns<SavingsGoalContribution[]>(),
    supabase
      .from("transactions")
      .select("type, amount")
      .in("type", ["income", "expense"])
      .gte("occurred_at", range.start)
      .lte("occurred_at", range.end)
      .returns<Pick<Transaction, "type" | "amount">[]>(),
    supabase
      .from("account_balances")
      .select("*")
      .eq("archived", false)
      .returns<AccountBalance[]>(),
    supabase
      .from("bills")
      .select("amount, next_due_date, active")
      .eq("active", true)
      .lte("next_due_date", range.endKey)
      .returns<Pick<Bill, "amount" | "next_due_date" | "active">[]>(),
  ]);

  const goalList = goals ?? [];
  const goalMap = new Map(goalList.map((goal) => [goal.id, goal]));
  const contributedByGoal = new Map<string, number>();
  for (const item of contributions ?? []) {
    contributedByGoal.set(
      item.goal_id,
      (contributedByGoal.get(item.goal_id) ?? 0) + Number(item.amount),
    );
  }

  const savings = (allocations ?? []).map((allocation) => {
    const savedThisMonth = contributedByGoal.get(allocation.goal_id) ?? 0;
    const amount = Number(allocation.amount);
    return {
      allocation,
      goal: goalMap.get(allocation.goal_id) ?? null,
      savedThisMonth,
      pct: amount > 0 ? (savedThisMonth / amount) * 100 : 0,
    };
  });

  const monthTransactions = transactions ?? [];
  const incomeReceived = monthTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const spent = monthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const totalBudget = Number(plan?.total_budget ?? 0);
  const expenseAllocated = budgets.reduce(
    (sum, item) => sum + item.baseAmount,
    0,
  );
  const savingsAllocated = savings.reduce(
    (sum, item) => sum + Number(item.allocation.amount),
    0,
  );
  const savedThisMonth = savings.reduce(
    (sum, item) => sum + item.savedThisMonth,
    0,
  );
  const allocated = expenseAllocated + savingsAllocated;
  const carryover = budgets.reduce((sum, item) => sum + item.carryover, 0);
  const unallocated = totalBudget - allocated;
  const remaining = totalBudget + carryover - spent - savedThisMonth;

  const localNow = toZonedTime(new Date(), timezone);
  const totalDays = daysInMonthKey(monthStart);
  const elapsedDays = isCurrentMonth
    ? localNow.getDate()
    : isPastMonth
      ? totalDays
      : 0;
  const forecastExpense =
    elapsedDays > 0 ? Math.max(spent, (spent / elapsedDays) * totalDays) : 0;
  const spendingCeiling = Math.max(totalBudget - savingsAllocated + carryover, 0);
  const forecastRemaining = spendingCeiling - forecastExpense;
  const projectedOver = Math.max(-forecastRemaining, 0);

  const availableNow = (accounts ?? [])
    .filter((account) => account.is_spending)
    .reduce((sum, account) => sum + Number(account.balance), 0);
  const expectedIncome = Number(plan?.expected_income ?? 0);
  const expectedIncomeLeft = isPastMonth
    ? 0
    : Math.max(expectedIncome - incomeReceived, 0);
  const upcomingBills = isPastMonth
    ? 0
    : (activeBills ?? [])
        .filter((bill) =>
          isCurrentMonth
            ? true
            : bill.next_due_date >= monthStart,
        )
        .reduce((sum, bill) => sum + Number(bill.amount), 0);
  const projectedAvailable = availableNow + expectedIncomeLeft - upcomingBills;

  const recommendations: BudgetRecommendation[] = [];
  if (!plan || totalBudget <= 0) {
    recommendations.push({
      level: "info",
      title: "Set your total monthly budget",
      detail: "Add the full amount you can spend and save this month.",
    });
  } else if (unallocated < 0) {
    recommendations.push({
      level: "error",
      title: "Your allotments are above your budget",
      detail: `Reduce category or savings allotments by ${formatMoney(Math.abs(unallocated), currency)}.`,
    });
  } else if (unallocated > totalBudget * 0.05) {
    recommendations.push({
      level: "info",
      title: "You still have money to assign",
      detail: `Allocate the remaining ${formatMoney(unallocated, currency)} to a category or savings goal.`,
    });
  }

  if (isCurrentMonth && projectedOver > 0) {
    recommendations.push({
      level: "error",
      title: "Spending may exceed your plan",
      detail: `At the current pace, expenses may go over by ${formatMoney(projectedOver, currency)} this month.`,
    });
  }

  const riskyCategory = budgets
    .filter((item) => item.forecastRemaining < 0)
    .sort((a, b) => a.forecastRemaining - b.forecastRemaining)[0];
  if (isCurrentMonth && riskyCategory) {
    recommendations.push({
      level: "warning",
      title: `Slow down on ${riskyCategory.category?.name ?? "this category"}`,
      detail: `Its forecast is ${formatMoney(Math.abs(riskyCategory.forecastRemaining), currency)} above the available allotment.`,
    });
  }

  if (totalBudget > 0 && savingsAllocated <= 0) {
    recommendations.push({
      level: "warning",
      title: "Add a required savings allotment",
      detail: "Treat savings like a bill so it is included before optional spending.",
    });
  }

  if (!isPastMonth && projectedAvailable < 0) {
    recommendations.push({
      level: "error",
      title: "Bills due may cause a cash shortage",
      detail: `Expected available cash is short by ${formatMoney(Math.abs(projectedAvailable), currency)}.`,
    });
  }

  return {
    monthStart,
    label: monthLabel(monthStart),
    isCurrentMonth,
    isPastMonth,
    plan: plan ?? null,
    budgets,
    goals: goalList,
    savings,
    summary: {
      totalBudget,
      expenseAllocated,
      savingsAllocated,
      allocated,
      carryover,
      spent,
      savedThisMonth,
      remaining,
      unallocated,
    },
    forecast: {
      expense: forecastExpense,
      spendingCeiling,
      remaining: forecastRemaining,
      projectedOver,
    },
    cashFlow: {
      availableNow,
      expectedIncome,
      incomeReceived,
      expectedIncomeLeft,
      upcomingBills,
      projectedAvailable,
    },
    recommendations: recommendations.slice(0, 5),
  };
}
