"use server";

import { revalidatePath } from "next/cache";
import { addWeeks, addMonths, addYears, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { checkCap } from "@/lib/plan-guard";
import { getActivePlan } from "@/lib/queries/billing";
import { PLANS } from "@/lib/plans";
import { getBudgetTemplate } from "@/lib/budget-templates";
import { isMonthStart, shiftMonthStart } from "@/lib/month";
import type {
  BillFrequency,
  Budget,
  Category,
  MonthlyBudgetPlan,
  MonthlyGoalAllocation,
} from "@/lib/supabase/types";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function auth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidate() {
  revalidatePath("/", "layout");
}

// ---- Budgets -------------------------------------------------------------

export async function upsertBudget(input: {
  id?: string;
  categoryId: string;
  customCategoryName?: string;
  amount: number;
  monthStart: string;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter a budget amount." };
  if (!isMonthStart(input.monthStart)) {
    return { ok: false, error: "Choose a valid budget month." };
  }

  if (input.id) {
    const { error } = await supabase
      .from("budgets")
      .update({ amount: input.amount })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, id: input.id };
  }

  const customCategoryName = input.customCategoryName?.trim();
  let categoryId = input.categoryId;
  let capAlreadyChecked = false;

  if (customCategoryName) {
    const { data: expenseCategories } = await supabase
      .from("categories")
      .select("id, name")
      .eq("kind", "expense")
      .returns<Pick<Category, "id" | "name">[]>();
    const existingCategory = (expenseCategories ?? []).find(
      (category) =>
        category.name.toLocaleLowerCase() ===
        customCategoryName.toLocaleLowerCase(),
    );

    if (existingCategory) {
      categoryId = existingCategory.id;
    } else {
      const { count } = await supabase
        .from("budgets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("month_start", input.monthStart);
      const capError = await checkCap("budgets", count ?? 0);
      if (capError) return { ok: false, error: capError };
      capAlreadyChecked = true;

      const { data: category, error } = await supabase
        .from("categories")
        .insert({
          user_id: user.id,
          name: customCategoryName,
          kind: "expense",
          is_system: false,
          sort_order: 100,
        })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      categoryId = category.id;
    }
  }

  if (!categoryId) return { ok: false, error: "Pick or create a category." };

  const { data: validCategory } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("kind", "expense")
    .maybeSingle();
  if (!validCategory) return { ok: false, error: "Category not found." };

  // Enforce the plan cap only when adding a budget for a new category.
  const { data: existing } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", user.id)
    .eq("category_id", categoryId)
    .eq("month_start", input.monthStart)
    .maybeSingle();
  if (!existing && !capAlreadyChecked) {
    const { count } = await supabase
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("month_start", input.monthStart);
    const capError = await checkCap("budgets", count ?? 0);
    if (capError) return { ok: false, error: capError };
  }

  // One budget per category — upsert on conflict.
  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      {
        user_id: user.id,
        category_id: categoryId,
        amount: input.amount,
        period: "monthly",
        active: true,
        month_start: input.monthStart,
      },
      { onConflict: "user_id,category_id,month_start" },
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function upsertMonthlyBudgetPlan(input: {
  monthStart: string;
  totalBudget: number;
  expectedIncome: number;
  carryOverEnabled: boolean;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!isMonthStart(input.monthStart)) {
    return { ok: false, error: "Choose a valid budget month." };
  }
  if (!Number.isFinite(input.totalBudget) || !(input.totalBudget > 0)) {
    return { ok: false, error: "Enter your total monthly budget." };
  }
  if (!Number.isFinite(input.expectedIncome) || input.expectedIncome < 0) {
    return { ok: false, error: "Enter a valid expected income." };
  }

  const { data, error } = await supabase
    .from("monthly_budget_plans")
    .upsert(
      {
        user_id: user.id,
        month_start: input.monthStart,
        total_budget: input.totalBudget,
        expected_income: input.expectedIncome,
        carry_over_enabled: input.carryOverEnabled,
      },
      { onConflict: "user_id,month_start" },
    )
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function upsertMonthlyGoalAllocation(input: {
  id?: string;
  monthStart: string;
  goalId: string;
  amount: number;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!isMonthStart(input.monthStart)) {
    return { ok: false, error: "Choose a valid budget month." };
  }
  if (!input.goalId) return { ok: false, error: "Choose a savings goal." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };

  const { data: goal } = await supabase
    .from("savings_goals")
    .select("id")
    .eq("id", input.goalId)
    .maybeSingle();
  if (!goal) return { ok: false, error: "Savings goal not found." };

  const { data, error } = await supabase
    .from("monthly_goal_allocations")
    .upsert(
      {
        user_id: user.id,
        month_start: input.monthStart,
        goal_id: input.goalId,
        amount: input.amount,
      },
      { onConflict: "user_id,month_start,goal_id" },
    )
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function deleteMonthlyGoalAllocation(
  id: string,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase
    .from("monthly_goal_allocations")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function applyBudgetTemplate(input: {
  monthStart: string;
  totalBudget: number;
  templateId: string;
  savingsGoalId?: string;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!isMonthStart(input.monthStart)) {
    return { ok: false, error: "Choose a valid budget month." };
  }
  if (!(input.totalBudget > 0)) {
    return { ok: false, error: "Set your total monthly budget first." };
  }
  const template = getBudgetTemplate(input.templateId);
  if (!template) return { ok: false, error: "Budget template not found." };

  let verifiedSavingsGoalId: string | null = null;
  if (input.savingsGoalId) {
    const { data: goal } = await supabase
      .from("savings_goals")
      .select("id")
      .eq("id", input.savingsGoalId)
      .maybeSingle();
    if (!goal) return { ok: false, error: "Savings goal not found." };
    verifiedSavingsGoalId = goal.id;
  }

  const [{ data: categories }, { data: existing }, activePlan] =
    await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("kind", "expense")
        .returns<Category[]>(),
      supabase
        .from("budgets")
        .select("*")
        .eq("month_start", input.monthStart)
        .returns<Budget[]>(),
      getActivePlan(),
    ]);

  const categoryMap = new Map(
    (categories ?? []).map((category) => [category.name.toLowerCase(), category]),
  );
  const rows = template.categories
    .map((item) => {
      const category = categoryMap.get(item.name.toLowerCase());
      return category
        ? {
            user_id: user.id,
            category_id: category.id,
            month_start: input.monthStart,
            amount: Math.round(input.totalBudget * item.percent) / 100,
            period: "monthly" as const,
            active: true,
          }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const union = new Set([
    ...(existing ?? []).map((budget) => budget.category_id),
    ...rows.map((row) => row.category_id),
  ]);
  const limit = PLANS[activePlan].limits.budgets;
  if (typeof limit === "number" && union.size > limit) {
    return {
      ok: false,
      error: `Your ${PLANS[activePlan].name} plan allows up to ${limit} budgets. Choose categories manually or upgrade for a full template.`,
    };
  }

  const { error: planError } = await supabase
    .from("monthly_budget_plans")
    .upsert(
      {
        user_id: user.id,
        month_start: input.monthStart,
        total_budget: input.totalBudget,
      },
      { onConflict: "user_id,month_start" },
    );
  if (planError) return { ok: false, error: planError.message };

  if (rows.length > 0) {
    const { error } = await supabase
      .from("budgets")
      .upsert(rows, { onConflict: "user_id,category_id,month_start" });
    if (error) return { ok: false, error: error.message };
  }

  if (verifiedSavingsGoalId && template.savingsPercent > 0) {
    const { error } = await supabase.from("monthly_goal_allocations").upsert(
      {
        user_id: user.id,
        goal_id: verifiedSavingsGoalId,
        month_start: input.monthStart,
        amount:
          Math.round(input.totalBudget * template.savingsPercent) / 100,
      },
      { onConflict: "user_id,month_start,goal_id" },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidate();
  return { ok: true };
}

export async function copyPreviousMonthPlan(
  monthStart: string,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!isMonthStart(monthStart)) {
    return { ok: false, error: "Choose a valid budget month." };
  }
  const previousMonth = shiftMonthStart(monthStart, -1);

  const [
    { data: previousPlan },
    { data: previousBudgets },
    { data: currentBudgets },
    { data: previousSavings },
    activePlan,
  ] = await Promise.all([
    supabase
      .from("monthly_budget_plans")
      .select("*")
      .eq("month_start", previousMonth)
      .maybeSingle<MonthlyBudgetPlan>(),
    supabase
      .from("budgets")
      .select("*")
      .eq("month_start", previousMonth)
      .eq("active", true)
      .returns<Budget[]>(),
    supabase
      .from("budgets")
      .select("*")
      .eq("month_start", monthStart)
      .eq("active", true)
      .returns<Budget[]>(),
    supabase
      .from("monthly_goal_allocations")
      .select("*")
      .eq("month_start", previousMonth)
      .returns<MonthlyGoalAllocation[]>(),
    getActivePlan(),
  ]);

  if (!previousPlan && !(previousBudgets?.length || previousSavings?.length)) {
    return { ok: false, error: "The previous month has no plan to copy." };
  }

  const limit = PLANS[activePlan].limits.budgets;
  const copiedBudgetIds = new Set([
    ...(currentBudgets ?? []).map((budget) => budget.category_id),
    ...(previousBudgets ?? []).map((budget) => budget.category_id),
  ]);
  if (
    typeof limit === "number" &&
    copiedBudgetIds.size > limit
  ) {
    return {
      ok: false,
      error: `Your ${PLANS[activePlan].name} plan allows up to ${limit} budgets.`,
    };
  }

  if (previousPlan) {
    const { error } = await supabase.from("monthly_budget_plans").upsert(
      {
        user_id: user.id,
        month_start: monthStart,
        total_budget: Number(previousPlan.total_budget),
        expected_income: Number(previousPlan.expected_income),
        carry_over_enabled: previousPlan.carry_over_enabled,
      },
      { onConflict: "user_id,month_start" },
    );
    if (error) return { ok: false, error: error.message };
  }

  if (previousBudgets?.length) {
    const { error } = await supabase.from("budgets").upsert(
      previousBudgets.map((budget) => ({
        user_id: user.id,
        category_id: budget.category_id,
        month_start: monthStart,
        amount: Number(budget.amount),
        period: "monthly" as const,
        active: true,
      })),
      { onConflict: "user_id,category_id,month_start" },
    );
    if (error) return { ok: false, error: error.message };
  }

  if (previousSavings?.length) {
    const { error } = await supabase.from("monthly_goal_allocations").upsert(
      previousSavings.map((allocation) => ({
        user_id: user.id,
        goal_id: allocation.goal_id,
        month_start: monthStart,
        amount: Number(allocation.amount),
      })),
      { onConflict: "user_id,month_start,goal_id" },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidate();
  return { ok: true };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// ---- Bills ---------------------------------------------------------------

export type BillInput = {
  name: string;
  amount: number;
  categoryId: string | null;
  accountId: string | null;
  frequency: BillFrequency;
  nextDueDate: string; // YYYY-MM-DD
  remindDaysBefore: number;
  notes?: string | null;
};

export async function upsertBill(
  input: BillInput & { id?: string },
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.name.trim()) return { ok: false, error: "Name the bill." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };
  if (!input.nextDueDate) return { ok: false, error: "Pick a due date." };

  const row = {
    name: input.name.trim(),
    amount: input.amount,
    category_id: input.categoryId,
    account_id: input.accountId,
    frequency: input.frequency,
    next_due_date: input.nextDueDate,
    remind_days_before: input.remindDaysBefore,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("bills")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("bills")
    .insert({ user_id: user.id, active: true, ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function deleteBill(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("bills").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

function advanceDueDate(current: string, frequency: BillFrequency): string {
  const d = new Date(`${current}T12:00:00`);
  switch (frequency) {
    case "weekly":
      return format(addWeeks(d, 1), "yyyy-MM-dd");
    case "monthly":
      return format(addMonths(d, 1), "yyyy-MM-dd");
    case "yearly":
      return format(addYears(d, 1), "yyyy-MM-dd");
    case "once":
    default:
      return current;
  }
}

/**
 * Mark a bill paid: create the linked expense transaction, record the payment,
 * and advance the due date (or deactivate a one-off).
 */
export async function markBillPaid(input: {
  billId: string;
  amount: number;
  accountId: string;
  paidForDate: string; // YYYY-MM-DD (the due date being paid)
  occurredAt?: string; // ISO; defaults to now
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };
  if (!input.accountId) return { ok: false, error: "Choose an account." };

  const { data: bill, error: billErr } = await supabase
    .from("bills")
    .select("*")
    .eq("id", input.billId)
    .single();
  if (billErr || !bill) {
    return { ok: false, error: billErr?.message ?? "Bill not found." };
  }

  // 1. Create the expense transaction (linked to the bill).
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: "expense",
      amount: input.amount,
      category_id: bill.category_id,
      account_id: input.accountId,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      merchant: bill.name,
      bill_id: bill.id,
    })
    .select("id")
    .single();
  if (txErr) return { ok: false, error: txErr.message };

  // 2. Record the payment.
  const { error: payErr } = await supabase.from("bill_payments").insert({
    user_id: user.id,
    bill_id: bill.id,
    transaction_id: tx.id,
    paid_for_date: input.paidForDate,
  });
  if (payErr) return { ok: false, error: payErr.message };

  // 3. Advance the due date (or close a one-off).
  if (bill.frequency === "once") {
    await supabase.from("bills").update({ active: false }).eq("id", bill.id);
  } else {
    await supabase
      .from("bills")
      .update({
        next_due_date: advanceDueDate(bill.next_due_date, bill.frequency),
      })
      .eq("id", bill.id);
  }

  revalidate();
  return { ok: true, id: tx.id };
}
