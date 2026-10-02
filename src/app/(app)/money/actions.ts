"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth";
import { categoryKey, normalizeCategoryName } from "@/lib/category-name";
import { merchantKey } from "@/lib/transaction-parser";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { friendlyDbError } from "@/lib/supabase/errors";
import {
  checkCap,
  checkTransactionCap,
  requireProFeature,
} from "@/lib/plan-guard";
import {
  getTransactions,
  type TransactionFilters,
} from "@/lib/queries/money";
import {
  deriveUndoKey,
  signUndoToken,
  verifyUndoToken,
} from "@/lib/undo-token";
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
  if (!(await requireActiveUser())) return [];
  return getTransactions(filters);
}

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export type ExportResult =
  | { ok: true; transactions: Transaction[] }
  | { ok: false; error: string };

/** `undo` is the signed token restoreTransaction needs — opaque to the client. */
export type DeleteResult =
  | { ok: true; undo?: string }
  | { ok: false; error: string };

/**
 * Transactions for CSV export. The plan check lives HERE (server-side) rather
 * than only in the UI — a locked button is a hint, not a control.
 */
export async function exportTransactionsAction(): Promise<ExportResult> {
  const active = await requireActiveUser();
  if (!active) {
    return { ok: false, error: "You're not signed in." };
  }

  const locked = await requireProFeature("csvExport", "CSV export");
  if (locked) return { ok: false, error: locked };

  // Ranged pages, not one huge range: PostgREST clamps any range to max-rows
  // (1000) with no error, so a long history exported silently truncated. `id`
  // breaks occurred_at ties so pages can't repeat or skip rows.
  const { rows, error } = await fetchAllPages((from, to) =>
    active.supabase
      .from("transactions")
      .select("*")
      .order("occurred_at", { ascending: false })
      .order("id")
      .range(from, to)
      .returns<Transaction[]>(),
  );
  if (error) {
    // A partial file would pass for a complete one, so fail the whole export.
    console.error("[exportTransactionsAction] query failed:", error.message);
    return { ok: false, error: "Couldn't export your transactions. Try again." };
  }
  return { ok: true, transactions: rows };
}

async function auth() {
  // requireActiveUser() is null for a suspended / revoked account as well as a
  // signed-out one, so callers refuse the write either way.
  const active = await requireActiveUser();
  if (active) return active;
  return { supabase: await createClient(), user: null };
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

/**
 * Upgrade message once the plan's monthly transaction limit is reached.
 * Counted on created_at, not occurred_at, like the statement importer: the
 * date on an entry is the user's to pick, so an occurred_at window let every
 * backdated entry skip the count.
 */
async function transactionCapError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart.toISOString());
  return checkTransactionCap(count ?? 0);
}

export async function createTransaction(
  input: TransactionInput,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };
  if (!input.accountId) return { ok: false, error: "Choose an account." };

  // Enforce the monthly transaction limit for the user's plan.
  const capError = await transactionCapError(supabase, user.id);
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

  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this transaction.") };
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

  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this transaction.") };
  revalidateMoney();
  return { ok: true, id };
}

/**
 * HMAC key for undo tokens, derived one-way from the service-role key so it
 * needs no extra env var and never reaches the browser. Empty when the app runs
 * without one — Undo then falls back to re-entering the client's copy.
 */
function undoKey(): string {
  return deriveUndoKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Re-inserts a just-deleted transaction (for Undo).
 *
 * With the token deleteTransaction handed back, the original row goes in
 * exactly as it was signed — same id, same created_at — and no cap applies:
 * undoing a delete must not be refused because the deleted row was created in
 * an earlier month, nor spend a slot from this one. Without a valid token the
 * client's copy is re-entered as a new row and passes the same cap as a new
 * entry — except for transfers and adjustments, which createTransfer and
 * createAdjustment never cap either.
 */
export async function restoreTransaction(
  t: Transaction,
  undo?: string,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };

  const signed = verifyUndoToken(undo, {
    key: undoKey(),
    now: Date.now(),
    userId: user.id,
  });

  if (!signed) {
    if (!(Number(t.amount) > 0)) return { ok: false, error: "Enter an amount." };
    if (t.type === "income" || t.type === "expense") {
      const capError = await transactionCapError(supabase, user.id);
      if (capError) return { ok: false, error: capError };
    }
  }

  const row = signed ?? {
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
  };

  const { error } = await supabase.from("transactions").insert(row);
  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't restore this transaction.") };
  revalidateMoney();
  return { ok: true };
}

/**
 * Deletes a transaction and signs the row it removed, so Undo can restore that
 * row rather than whatever the browser still had on screen.
 */
export async function deleteTransaction(id: string): Promise<DeleteResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .select("*")
    .maybeSingle<Transaction>();
  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't delete this transaction.") };
  revalidateMoney();

  const key = undoKey();
  // No row means it was already gone, so there is nothing to offer an undo of.
  if (!data || !key) return { ok: true };
  return {
    ok: true,
    undo: signUndoToken(
      {
        id: data.id,
        user_id: data.user_id,
        type: data.type,
        amount: data.amount,
        category_id: data.category_id,
        account_id: data.account_id,
        to_account_id: data.to_account_id,
        direction: data.direction,
        occurred_at: data.occurred_at,
        merchant: data.merchant,
        notes: data.notes,
        created_at: data.created_at,
      },
      { key, now: Date.now() },
    ),
  };
}

// ---- Duplicate detection -------------------------------------------------

export type DuplicateMatch = Pick<
  Transaction,
  | "id"
  | "amount"
  | "occurred_at"
  | "merchant"
  | "category_id"
  | "account_id"
  | "import_fingerprint"
>;

/**
 * Possible duplicates of a transaction about to be saved: same type and
 * amount, within a small date window, with exact-account matches preferred and
 * merchant overlap used to catch manual entries that duplicate imported rows.
 * Never deletes anything — the caller shows a warning and lets the user
 * continue or cancel. Owner-scoped by RLS.
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
  const from = new Date(at.getTime() - 60 * 60 * 60 * 1000).toISOString();
  const to = new Date(at.getTime() + 60 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("transactions")
    .select(
      "id, amount, occurred_at, merchant, category_id, account_id, import_fingerprint",
    )
    .eq("type", input.type)
    .eq("amount", input.amount)
    .gte("occurred_at", from)
    .lte("occurred_at", to)
    .order("occurred_at", { ascending: false })
    .limit(5);
  if (input.excludeId) query = query.neq("id", input.excludeId);

  const { data } = await query.returns<DuplicateMatch[]>();
  const rows = data ?? [];
  const needle = input.merchant ? merchantKey(input.merchant) : "";
  if (!needle) {
    return rows.filter((r) => r.account_id === input.accountId).slice(0, 3);
  }

  return rows
    .map((r) => {
      const key = r.merchant ? merchantKey(r.merchant) : "";
      const merchantOverlap = Boolean(
        key && (key.includes(needle) || needle.includes(key)),
      );
      const sameAccount = r.account_id === input.accountId;
      const imported = Boolean(r.import_fingerprint);
      return { row: r, merchantOverlap, sameAccount, imported };
    })
    .filter((r) => {
      return r.sameAccount || r.merchantOverlap;
    })
    .sort((a, b) => {
      const aScore =
        (a.sameAccount ? 4 : 0) +
        (a.merchantOverlap ? 3 : 0) +
        (a.imported ? 1 : 0);
      const bScore =
        (b.sameAccount ? 4 : 0) +
        (b.merchantOverlap ? 3 : 0) +
        (b.imported ? 1 : 0);
      return bScore - aScore;
    })
    .map((match) => match.row)
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

  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this transfer.") };
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

  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this adjustment.") };
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

  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this account.") };
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

  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't save this account.") };
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
  if (error) return { ok: false, error: friendlyDbError(error, "Couldn't update this account.") };
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
    return { ok: false, error: friendlyDbError(readError, "Couldn't check categories.") };
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
    return { ok: false, error: friendlyDbError(error, "Couldn't create the category.") };
  }

  revalidatePath("/money", "layout");
  return { ok: true, category: data };
}
