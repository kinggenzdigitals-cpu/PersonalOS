"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { merchantKey } from "@/lib/transaction-parser";
import { isSchemaMissing, migrationRequired } from "@/lib/supabase/errors";
import type {
  MerchantCategory,
  Transaction,
  TransactionFavorite,
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

// ---- Per-user category learning -----------------------------------------

/**
 * The category this user has previously chosen for a merchant. Checks the
 * learned mapping first, then falls back to their most recent transaction with
 * the same merchant. Returns null when there's nothing to go on.
 *
 * Learning is strictly per-user: every read and write is owner-scoped by RLS,
 * and nothing is shared or aggregated across accounts.
 */
export async function getLearnedCategory(
  merchant: string,
): Promise<string | null> {
  const key = merchantKey(merchant);
  if (!key) return null;

  const { supabase, user } = await auth();
  if (!user) return null;

  const { data, error } = await supabase
    .from("merchant_categories")
    .select("category_id")
    .eq("merchant_key", key)
    .maybeSingle<Pick<MerchantCategory, "category_id">>();
  // Table may not exist yet (migration 0014 not applied) — degrade quietly.
  if (!error && data?.category_id) return data.category_id;

  // Fallback: the category used most recently for the same merchant. Compare
  // on the NORMALISED key in JS — `merchant` stores raw user text, so matching
  // the stripped key against it in SQL would miss "7-Eleven", "Shell Station!"
  // and anything else containing punctuation.
  const { data: recent } = await supabase
    .from("transactions")
    .select("merchant, category_id")
    .not("category_id", "is", null)
    .not("merchant", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(200)
    .returns<Pick<Transaction, "merchant" | "category_id">[]>();

  for (const t of recent ?? []) {
    if (t.merchant && merchantKey(t.merchant) === key) return t.category_id;
  }
  return null;
}

/**
 * Remember that this user files `merchant` under `categoryId`. Called after a
 * save so the next entry for the same merchant is pre-filled. Best-effort:
 * a failure here must never break saving a transaction.
 */
export async function learnCategory(
  merchant: string | null | undefined,
  categoryId: string | null,
): Promise<void> {
  if (!merchant || !categoryId) return;
  const key = merchantKey(merchant);
  if (!key) return;

  try {
    const { supabase, user } = await auth();
    if (!user) return;

    const { data: existing } = await supabase
      .from("merchant_categories")
      .select("id, category_id, hit_count")
      .eq("merchant_key", key)
      .maybeSingle<Pick<MerchantCategory, "id" | "category_id" | "hit_count">>();

    if (existing) {
      await supabase
        .from("merchant_categories")
        .update({
          category_id: categoryId,
          // Reset the count when the user corrects us; strengthen when they agree.
          hit_count:
            existing.category_id === categoryId ? existing.hit_count + 1 : 1,
        })
        .eq("id", existing.id);
      return;
    }

    await supabase.from("merchant_categories").insert({
      user_id: user.id,
      merchant_key: key,
      category_id: categoryId,
    });
  } catch {
    // Learning is an optimisation — never surface a failure.
  }
}

// ---- Favourite (saved) transactions --------------------------------------

export async function listFavorites(): Promise<TransactionFavorite[]> {
  const { supabase, user } = await auth();
  if (!user) return [];
  const { data, error } = await supabase
    .from("transaction_favorites")
    .select("*")
    .order("sort_order")
    .order("created_at")
    .returns<TransactionFavorite[]>();
  if (error) return []; // table may not exist yet
  return data ?? [];
}

export type FavoriteInput = {
  label: string;
  type: "income" | "expense";
  amount: number | null;
  categoryId: string | null;
  accountId: string | null;
  merchant: string | null;
};

export async function saveFavorite(
  input: FavoriteInput & { id?: string },
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };

  const label = input.label.trim();
  if (!label) return { ok: false, error: "Name this favourite." };
  if (input.amount !== null && !(input.amount > 0)) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  if (input.type !== "income" && input.type !== "expense") {
    return { ok: false, error: "Choose income or expense." };
  }

  const row = {
    label,
    type: input.type,
    amount: input.amount,
    category_id: input.categoryId,
    account_id: input.accountId,
    merchant: input.merchant?.trim() || null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("transaction_favorites")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, id: input.id };
  }

  const { count } = await supabase
    .from("transaction_favorites")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data, error } = await supabase
    .from("transaction_favorites")
    .insert({ user_id: user.id, sort_order: count ?? 0, ...row })
    .select("id")
    .single();
  if (error) {
    if (isSchemaMissing(error)) {
      return { ok: false, error: migrationRequired("Favourites", "0014") };
    }
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true, id: data.id };
}

export async function deleteFavorite(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase
    .from("transaction_favorites")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
