"use server";

import { revalidatePath } from "next/cache";
import { addWeeks, addMonths, addYears, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { checkCap } from "@/lib/plan-guard";
import type { BillFrequency } from "@/lib/supabase/types";

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
  amount: number;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.categoryId) return { ok: false, error: "Pick a category." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter a budget amount." };

  if (input.id) {
    const { error } = await supabase
      .from("budgets")
      .update({ category_id: input.categoryId, amount: input.amount })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, id: input.id };
  }

  // Enforce the plan cap only when adding a budget for a new category.
  const { data: existing } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", user.id)
    .eq("category_id", input.categoryId)
    .maybeSingle();
  if (!existing) {
    const { count } = await supabase
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    const capError = await checkCap("budgets", count ?? 0);
    if (capError) return { ok: false, error: capError };
  }

  // One budget per category — upsert on conflict.
  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      {
        user_id: user.id,
        category_id: input.categoryId,
        amount: input.amount,
        period: "monthly",
        active: true,
      },
      { onConflict: "user_id,category_id" },
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
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
