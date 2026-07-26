"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkCap } from "@/lib/plan-guard";
import {
  getTransactions,
  type TransactionFilters,
} from "@/lib/queries/money";
import type {
  AccountType,
  AdjustmentDirection,
  Transaction,
} from "@/lib/supabase/types";

/** Filtered/paged transaction fetch for the client transactions view. */
export async function fetchTransactionsAction(
  filters: TransactionFilters,
): Promise<Transaction[]> {
  return getTransactions(filters);
}

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

function revalidateMoney() {
  revalidatePath("/", "layout");
}

// ---- Transactions --------------------------------------------------------

export type TransactionInput = {
  type: "income" | "expense";
  amount: number;
  categoryId: string | null;
  accountId: string;
  occurredAt: string; // ISO
  merchant?: string | null;
  notes?: string | null;
};

export async function createTransaction(
  input: TransactionInput,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };
  if (!input.accountId) return { ok: false, error: "Choose an account." };

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: input.type,
      amount: input.amount,
      category_id: input.categoryId,
      account_id: input.accountId,
      occurred_at: input.occurredAt,
      merchant: input.merchant?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateMoney();
  return { ok: true, id: data.id };
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };

  const { error } = await supabase
    .from("transactions")
    .update({
      type: input.type,
      amount: input.amount,
      category_id: input.categoryId,
      account_id: input.accountId,
      occurred_at: input.occurredAt,
      merchant: input.merchant?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateMoney();
  return { ok: true, id };
}

/** Re-inserts a just-deleted transaction (for Undo). */
export async function restoreTransaction(
  t: Transaction,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("transactions").insert({
    id: t.id,
    user_id: user.id,
    type: t.type,
    amount: t.amount,
    category_id: t.category_id,
    account_id: t.account_id,
    to_account_id: t.to_account_id,
    direction: t.direction,
    occurred_at: t.occurred_at,
    merchant: t.merchant,
    notes: t.notes,
  });
  if (error) return { ok: false, error: error.message };
  revalidateMoney();
  return { ok: true, id: t.id };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateMoney();
  return { ok: true };
}

// ---- Transfer ------------------------------------------------------------

export async function createTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  occurredAt: string;
  notes?: string | null;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };
  if (!input.fromAccountId || !input.toAccountId) {
    return { ok: false, error: "Choose both accounts." };
  }
  if (input.fromAccountId === input.toAccountId) {
    return { ok: false, error: "Pick two different accounts." };
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: "transfer",
      amount: input.amount,
      account_id: input.fromAccountId,
      to_account_id: input.toAccountId,
      category_id: null,
      occurred_at: input.occurredAt,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateMoney();
  return { ok: true, id: data.id };
}

// ---- Adjustment ----------------------------------------------------------

export async function createAdjustment(input: {
  accountId: string;
  direction: AdjustmentDirection;
  amount: number;
  occurredAt: string;
  notes?: string | null;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };
  if (!input.accountId) return { ok: false, error: "Choose an account." };

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: "adjustment",
      direction: input.direction,
      amount: input.amount,
      account_id: input.accountId,
      category_id: null,
      occurred_at: input.occurredAt,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateMoney();
  return { ok: true, id: data.id };
}

// ---- Accounts ------------------------------------------------------------

export type AccountInput = {
  name: string;
  type: AccountType;
  opening_balance: number;
  is_spending: boolean;
  icon?: string | null;
  color?: string | null;
  low_balance_threshold?: number | null;
};

export async function createAccount(
  input: AccountInput,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the account a name." };

  const { count } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("archived", false);

  const capError = await checkCap("accounts", count ?? 0);
  if (capError) return { ok: false, error: capError };

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name,
      type: input.type,
      opening_balance: input.opening_balance,
      is_spending: input.is_spending,
      icon: input.icon ?? null,
      color: input.color ?? null,
      low_balance_threshold: input.low_balance_threshold ?? null,
      sort_order: count ?? 0,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateMoney();
  return { ok: true, id: data.id };
}

export async function updateAccount(
  id: string,
  input: AccountInput,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the account a name." };

  const { error } = await supabase
    .from("accounts")
    .update({
      name,
      type: input.type,
      opening_balance: input.opening_balance,
      is_spending: input.is_spending,
      icon: input.icon ?? null,
      color: input.color ?? null,
      low_balance_threshold: input.low_balance_threshold ?? null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateMoney();
  return { ok: true, id };
}

export async function setAccountArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase
    .from("accounts")
    .update({ archived })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateMoney();
  return { ok: true };
}
