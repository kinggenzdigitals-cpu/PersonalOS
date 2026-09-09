"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categoryKey, normalizeCategoryName } from "@/lib/category-name";
import {
  checkCap,
  checkTransactionCap,
  requireProFeature,
} from "@/lib/plan-guard";
import {
  getTransactions,
  type TransactionFilters,
} from "@/lib/queries/money";
import type {
  Category,
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

export type ExportResult =
  | { ok: true; transactions: Transaction[] }
  | { ok: false; error: string };

/**
 * Transactions for CSV export. The plan check lives HERE (server-side) rather
 * than only in the UI — a locked button is a hint, not a control.
 */
export async function exportTransactionsAction(): Promise<ExportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const locked = await requireProFeature("csvExport", "CSV export");
  if (locked) return { ok: false, error: locked };

  return {
    ok: true,
    transactions: await getTransactions({ limit: 100000, offset: 0 }),
  };
}

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

  // Enforce the monthly transaction limit for the user's plan.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("occurred_at", monthStart.toISOString());
  const capError = await checkTransactionCap(count ?? 0);
  if (capError) return { ok: false, error: capError };

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

// ---- Duplicate detection -------------------------------------------------

export type DuplicateMatch = Pick<
  Transaction,
  "id" | "amount" | "occurred_at" | "merchant" | "category_id" | "account_id"
>;

/**
 * Possible duplicates of a transaction about to be saved: same type, account
 * and amount, within ±1 day, and (when a merchant is given) a merchant that
 * overlaps. Never deletes anything — the caller shows a warning and lets the
 * user continue or cancel. Owner-scoped by RLS.
 */
export async function findPossibleDuplicates(input: {
  type: "income" | "expense";
  amount: number;
  accountId: string;
  occurredAt: string; // ISO
  merchant?: string | null;
  excludeId?: string; // when editing, ignore the row itself
}): Promise<DuplicateMatch[]> {
  const { supabase, user } = await auth();
  if (!user || !(input.amount > 0) || !input.accountId) return [];

  const at = new Date(input.occurredAt);
  if (Number.isNaN(at.getTime())) return [];
  const from = new Date(at.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const to = new Date(at.getTime() + 36 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("transactions")
    .select("id, amount, occurred_at, merchant, category_id, account_id")
    .eq("type", input.type)
    .eq("account_id", input.accountId)
    .eq("amount", input.amount)
    .gte("occurred_at", from)
    .lte("occurred_at", to)
    .order("occurred_at", { ascending: false })
    .limit(5);
  if (input.excludeId) query = query.neq("id", input.excludeId);

  const { data } = await query.returns<DuplicateMatch[]>();
  const rows = data ?? [];
  const needle = input.merchant?.trim().toLowerCase();
  if (!needle) return rows.slice(0, 3);

  // Prefer merchant overlap; a same-amount row with no merchant still counts.
  return rows
    .filter((r) => {
      const m = r.merchant?.toLowerCase();
      return !m || m.includes(needle) || needle.includes(m);
    })
    .slice(0, 3);
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

/**
 * Creates an expense/income category inline, or returns the existing one that
 * matches. Written for the New Budget form's combobox, where leaving the modal
 * just to add a category is the friction being removed.
 *
 * Normalisation is the whole point here. "Food", "food" and "  FOOD  " are the
 * same category to a person, so they collapse to one key before anything is
 * decided: trimmed, inner whitespace squeezed, compared case-insensitively.
 * A match RETURNS THE EXISTING ROW rather than erroring — from the caller's
 * point of view "give me the Food category" succeeded either way, and an error
 * would just make the UI ask the user to solve a problem it already solved.
 *
 * The display name keeps the user's own capitalisation on create; only the
 * comparison is normalised. Migration 0023 enforces the same rule with a unique
 * index on (user_id, kind, lower(btrim(name))), because this check-then-insert
 * has a race window that only the database can close.
 *
 * `kind` is deliberately explicit rather than defaulted: budgets are expense-only,
 * and silently minting an expense category from an income context — or vice
 * versa — would corrupt every per-kind total that reads this table.
 */
export async function createCategory(
  name: string,
  kind: "expense" | "income",
): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };

  // Same normalisation the combobox applies before it offers "Create …", so
  // the UI never offers to create something this refuses to.
  const clean = normalizeCategoryName(name);
  if (!clean) return { ok: false, error: "Give the category a name." };

  const { data: existing, error: readError } = await supabase
    .from("categories")
    .select("*")
    .eq("kind", kind)
    .returns<Category[]>();
  if (readError) {
    return { ok: false, error: `Couldn't check categories: ${readError.message}` };
  }

  const key = categoryKey(clean);
  const match = (existing ?? []).find((c) => categoryKey(c.name) === key);
  if (match) return { ok: true, category: match };

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name: clean,
      kind,
      sort_order: (existing ?? []).length,
    })
    .select("*")
    .single<Category>();

  if (error) {
    // 23505 = the 0023 unique index firing on a concurrent insert of the same
    // name. Re-read rather than fail: the row the caller wanted now exists.
    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("categories")
        .select("*")
        .eq("kind", kind)
        .returns<Category[]>();
      const found = (raced ?? []).find((c) => categoryKey(c.name) === key);
      if (found) return { ok: true, category: found };
    }
    return { ok: false, error: `Couldn't create the category: ${error.message}` };
  }

  revalidatePath("/money", "layout");
  return { ok: true, category: data };
}
