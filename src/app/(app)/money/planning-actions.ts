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
  if (!Number.isFinite(input.amount) || !(input.amount > 0)) return { ok: false, error: "Enter a budget amount." };
  if (!isMonthStart(input.monthStart)) {
    return { ok: false, error: "Choose a valid budget month." };
  }

  if (input.id) {
    const { error } = await supabase
      .from("monthly_category_budgets")
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
        .from("monthly_category_budgets")
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
    .from("monthly_category_budgets")
    .select("id")
    .eq("user_id", user.id)
    .eq("category_id", categoryId)
    .eq("month_start", input.monthStart)
    .maybeSingle();
  if (!existing && !capAlreadyChecked) {
    const { count } = await supabase
      .from("monthly_category_budgets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("month_start", input.monthStart);
    const capError = await checkCap("budgets", count ?? 0);
    if (capError) return { ok: false, error: capError };
  }

  // One budget per category — upsert on conflict.
  const { data, error } = await supabase
    .from("monthly_category_budgets")
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
  if (!Number.isFinite(input.amount) || !(input.amount > 0)) return { ok: false, error: "Enter an amount." };

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
  monthStart: string; totalBudget: number; templateId: string; savingsGoalId?: string;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!isMonthStart(input.monthStart) || !Number.isFinite(input.totalBudget) || input.totalBudget <= 0) {
    return { ok: false, error: "Set a valid monthly plan first." };
  }
  const template = getBudgetTemplate(input.templateId);
  if (!template) return { ok: false, error: "Budget template not found." };
  const { data: categories, error } = await supabase.from("categories").select("*")
    .eq("kind", "expense").returns<Category[]>();
  if (error) return { ok: false, error: "Categories could not be loaded. Please try again." };
  const rows: { category_id: string; amount: number }[] = [];
  for (const item of template.categories) {
    const category = categories?.find(c => c.name.toLowerCase() === item.name.toLowerCase());
    if (!category) return { ok: false, error: `This template needs the "${item.name}" category. Add it or choose another template.` };
    const amount = Math.round(input.totalBudget * item.percent) / 100;
    if (amount <= 0) return { ok: false, error: "The budget is too small for this template." };
    rows.push({ category_id: category.id, amount });
  }
  const activePlan = await getActivePlan();
  const limit = PLANS[activePlan].limits.budgets;
  if (limit != null && rows.length > limit) {
    return { ok: false, error: `Your ${PLANS[activePlan].name} plan allows up to ${limit} budgets. Choose the Simple starter or add allotments manually.` };
  }
  const savings = input.savingsGoalId ? [{
    goal_id: input.savingsGoalId,
    amount: Math.round(input.totalBudget * template.savingsPercent) / 100,
  }] : [];
  const result = await supabase.rpc("initialize_monthly_budget", {
    p_month: input.monthStart, p_total: input.totalBudget, p_income: 0, p_carry: true,
    p_categories: rows, p_savings: savings,
  });
  if (result.error) return { ok: false, error: result.error.message };
  revalidate();
  return { ok: true };
}

export async function copyPreviousMonthPlan(monthStart: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!isMonthStart(monthStart)) return { ok: false, error: "Choose a valid budget month." };
  const previousMonth = shiftMonthStart(monthStart, -1);
  const [planResult, budgetResult, savingsResult, activePlan] = await Promise.all([
    supabase.from("monthly_budget_plans").select("*").eq("month_start", previousMonth).maybeSingle<MonthlyBudgetPlan>(),
    supabase.from("monthly_category_budgets").select("*").eq("month_start", previousMonth).eq("active", true).returns<Budget[]>(),
    supabase.from("monthly_goal_allocations").select("*").eq("month_start", previousMonth).returns<MonthlyGoalAllocation[]>(),
    getActivePlan(),
  ]);
  if (planResult.error || budgetResult.error || savingsResult.error) {
    return { ok: false, error: "The previous month could not be loaded. Please try again." };
  }
  const previousPlan = planResult.data;
  const budgets = budgetResult.data ?? [];
  const savings = savingsResult.data ?? [];
  const total = Number(previousPlan?.total_budget ?? 0) ||
    budgets.reduce((s,b)=>s+Number(b.amount),0) + savings.reduce((s,a)=>s+Number(a.amount),0);
  if (total <= 0) return { ok: false, error: "The previous month has no plan to copy." };
  const limit = PLANS[activePlan].limits.budgets;
  if (limit != null && budgets.length > limit) {
    return { ok: false, error: `Your ${PLANS[activePlan].name} plan allows up to ${limit} budgets.` };
  }
  const result = await supabase.rpc("initialize_monthly_budget", {
    p_month: monthStart, p_total: total,
    p_income: Number(previousPlan?.expected_income ?? 0),
    p_carry: previousPlan?.carry_over_enabled ?? false,
    p_categories: budgets.map(b=>({category_id:b.category_id,amount:Number(b.amount)})),
    p_savings: savings.map(s=>({goal_id:s.goal_id,amount:Number(s.amount)})),
  });
  if (result.error) return { ok: false, error: result.error.message };
  revalidate();
  return { ok: true };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("monthly_category_budgets").delete().eq("id", id);
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
  if (!Number.isFinite(input.amount) || !(input.amount > 0)) return { ok: false, error: "Enter an amount." };
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
  if (!Number.isFinite(input.amount) || !(input.amount > 0)) return { ok: false, error: "Enter an amount." };
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
