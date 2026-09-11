"use server";

import { revalidatePath } from "next/cache";
import { addWeeks, addMonths, addYears, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { checkCap } from "@/lib/plan-guard";
import { getProfile } from "@/lib/auth";
import { localDateKey } from "@/lib/date";
import { isSchemaMissing, migrationRequired } from "@/lib/supabase/errors";
import type { BillFrequency, CategoryKind } from "@/lib/supabase/types";

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
  carryover?: boolean;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.categoryId) return { ok: false, error: "Pick a category." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter a budget amount." };
  const carryover = Boolean(input.carryover);

  if (input.id) {
    const base = { category_id: input.categoryId, amount: input.amount };
    let { error } = await supabase
      .from("budgets")
      .update({ ...base, carryover })
      .eq("id", input.id);
    // `carryover` arrives with migration 0012 — retry without it if absent.
    if (isSchemaMissing(error)) {
      ({ error } = await supabase
        .from("budgets")
        .update(base)
        .eq("id", input.id));
    }
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
  const row = {
    user_id: user.id,
    category_id: input.categoryId,
    amount: input.amount,
    period: "monthly" as const,
    active: true,
  };
  let { data, error } = await supabase
    .from("budgets")
    .upsert({ ...row, carryover }, { onConflict: "user_id,category_id" })
    .select("id")
    .single();
  if (isSchemaMissing(error)) {
    ({ data, error } = await supabase
      .from("budgets")
      .upsert(row, { onConflict: "user_id,category_id" })
      .select("id")
      .single());
  }

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data?.id };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// ---- Overall monthly budget ---------------------------------------------

/** Round to 2 decimals (centavo precision) without float drift on display. */
function toMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Set (or update) the overall monthly budget total + required savings
 * allocation for the current month. Amounts are validated and stored as exact
 * numeric(12,2). Server-authoritative — the client never decides the amount.
 */
export async function setMonthlyBudget(input: {
  totalAmount: number;
  savingsTarget: number;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };

  const total = Number(input.totalAmount);
  const savings = Number(input.savingsTarget);
  if (!Number.isFinite(total) || total < 0) {
    return { ok: false, error: "Enter a valid budget amount." };
  }
  if (!Number.isFinite(savings) || savings < 0) {
    return { ok: false, error: "Enter a valid savings amount." };
  }
  if (total > 1_000_000_000) {
    return { ok: false, error: "That budget amount is too large." };
  }

  const profile = await getProfile();
  const periodStart = `${localDateKey(profile?.timezone ?? "Asia/Manila").slice(0, 7)}-01`;

  const { error } = await supabase.from("monthly_budgets").upsert(
    {
      user_id: user.id,
      period_start: periodStart,
      total_amount: toMoney(total),
      savings_target: toMoney(savings),
    },
    { onConflict: "user_id,period_start" },
  );

  if (error) {
    if (isSchemaMissing(error)) {
      return { ok: false, error: migrationRequired("Monthly budgets", "0011") };
    }
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true };
}

// ---- Bills ---------------------------------------------------------------

export type BillInput = {
  kind: CategoryKind;
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
  if (input.kind !== "income" && input.kind !== "expense") {
    return { ok: false, error: "Choose income or expense." };
  }

  const row = {
    kind: input.kind,
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

  // Bills are the app's recurring schedules — enforce the plan's cap.
  const { count } = await supabase
    .from("bills")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);
  const capError = await checkCap("recurring", count ?? 0);
  if (capError) return { ok: false, error: capError };

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

  const kind = bill.kind === "income" ? "income" : "expense";

  // 1. Create the linked transaction.
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: kind,
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

  // 2. Record the payment. This is the idempotency key — a unique index on
  //    (user_id, bill_id, paid_for_date) rejects a double-submit. If it fails
  //    we must remove the transaction created above, or it would linger as an
  //    orphan that still moves the account balance.
  const { error: payErr } = await supabase.from("bill_payments").insert({
    user_id: user.id,
    bill_id: bill.id,
    transaction_id: tx.id,
    paid_for_date: input.paidForDate,
  });
  if (payErr) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    if (payErr.code === "23505") {
      return {
        ok: false,
        error: "This bill is already marked paid for that date.",
      };
    }
    return { ok: false, error: payErr.message };
  }

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
