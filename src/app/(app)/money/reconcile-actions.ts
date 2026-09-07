"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissing, migrationRequired } from "@/lib/supabase/errors";
import { sameAmount, daysBetween, MAX_DAYS_APART } from "@/lib/reconcile";

export type ReconcileResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

async function auth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * "These are two different purchases." Marks the imported row reviewed so the
 * pair stops being suggested. Nothing is deleted.
 */
export async function keepBoth(importedId: string): Promise<ReconcileResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { error } = await supabase
    .from("transactions")
    .update({ reconciled_at: new Date().toISOString() })
    .eq("id", importedId)
    .not("import_fingerprint", "is", null);

  if (error) {
    if (isSchemaMissing(error)) {
      return { ok: false, error: migrationRequired("Reconciliation", "0021") };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Kept both transactions." };
}

/**
 * "These are the same purchase." Removes ONE of the two and marks the survivor
 * reviewed.
 *
 * Deleting the manual row is the default the UI offers, because the imported
 * row carries the bank's authoritative amount and date — but the user chooses,
 * and either way exactly one row is removed. RLS scopes both statements to the
 * caller, and the "is imported" guards stop this being used to delete an
 * arbitrary transaction by id.
 */
export async function mergeDuplicate(input: {
  importedId: string;
  manualId: string;
  keep: "imported" | "manual";
}): Promise<ReconcileResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.importedId || !input.manualId) {
    return { ok: false, error: "Nothing selected to merge." };
  }
  if (input.importedId === input.manualId) {
    return { ok: false, error: "Those are the same transaction." };
  }

  // Verify both rows are the caller's and are what they claim to be, so a
  // crafted request can't delete an unrelated transaction.
  const { data: rows, error: readErr } = await supabase
    .from("transactions")
    .select(
      "id, import_fingerprint, reconciled_at, bill_id, amount, account_id, type, occurred_at",
    )
    .in("id", [input.importedId, input.manualId])
    .returns<
      {
        id: string;
        import_fingerprint: string | null;
        reconciled_at: string | null;
        bill_id: string | null;
        amount: number;
        account_id: string;
        type: string;
        occurred_at: string;
      }[]
    >();

  if (readErr) {
    if (isSchemaMissing(readErr)) {
      return { ok: false, error: migrationRequired("Reconciliation", "0021") };
    }
    return { ok: false, error: readErr.message };
  }

  const importedRow = rows?.find((r) => r.id === input.importedId);
  const manualRow = rows?.find((r) => r.id === input.manualId);
  if (!importedRow || !manualRow) {
    return { ok: false, error: "One of those transactions no longer exists." };
  }
  if (!importedRow.import_fingerprint) {
    return { ok: false, error: "That row wasn't imported." };
  }
  if (manualRow.import_fingerprint) {
    return { ok: false, error: "Both of those rows were imported." };
  }
  if (importedRow.reconciled_at || manualRow.reconciled_at) {
    return {
      ok: false,
      error: "That pair was already reviewed. Refresh to see the current list.",
    };
  }

  // Re-verify the pair on the server. The panel can be stale (another tab, or
  // an already-resolved pair), and this action must never delete a row on the
  // strength of a client-supplied pairing alone.
  if (!sameAmount(Number(importedRow.amount), Number(manualRow.amount))) {
    return { ok: false, error: "Those transactions aren't the same amount." };
  }
  if (importedRow.account_id !== manualRow.account_id) {
    return { ok: false, error: "Those transactions are in different accounts." };
  }
  if (importedRow.type !== manualRow.type) {
    return { ok: false, error: "Those transactions aren't the same kind." };
  }
  const apart = daysBetween(
    importedRow.occurred_at.slice(0, 10),
    manualRow.occurred_at.slice(0, 10),
  );
  if (apart > MAX_DAYS_APART) {
    return { ok: false, error: "Those transactions are too far apart in time." };
  }

  const deleteId =
    input.keep === "imported" ? input.manualId : input.importedId;
  const keepId = input.keep === "imported" ? input.importedId : input.manualId;
  const deletingRow = input.keep === "imported" ? manualRow : importedRow;

  // bill_payments.transaction_id is ON DELETE CASCADE (0001), so removing a
  // transaction that settled a bill would silently destroy the payment record
  // — taking with it the bill's last-paid date AND the unique key that stops
  // the same bill being paid twice for one period. Refuse rather than
  // quietly corrupt bill history.
  if (deletingRow.bill_id) {
    return {
      ok: false,
      error:
        "That transaction is linked to a bill payment, so removing it would erase the bill's payment history. Keep both, or unlink the bill first.",
    };
  }

  const { error: delErr } = await supabase
    .from("transactions")
    .delete()
    .eq("id", deleteId);
  if (delErr) return { ok: false, error: delErr.message };

  // Mark the survivor reviewed. If this fails the row is simply offered again
  // next time, which is safe — but the delete already happened, so surface it
  // rather than reporting unqualified success.
  const { error: markErr } = await supabase
    .from("transactions")
    .update({ reconciled_at: new Date().toISOString() })
    .eq("id", keepId);
  if (markErr) {
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        "Duplicate removed, but the pair may be suggested again — refresh and dismiss it if so.",
    };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    message:
      input.keep === "imported"
        ? "Kept the imported transaction and removed your manual entry."
        : "Kept your manual entry and removed the imported row.",
  };
}

/** Mark every currently-suggested imported row as reviewed. */
export async function keepAll(importedIds: string[]): Promise<ReconcileResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (importedIds.length === 0) return { ok: true, message: "Nothing to do." };

  const { error } = await supabase
    .from("transactions")
    .update({ reconciled_at: new Date().toISOString() })
    .in("id", importedIds)
    .not("import_fingerprint", "is", null);

  if (error) {
    if (isSchemaMissing(error)) {
      return { ok: false, error: migrationRequired("Reconciliation", "0021") };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `Dismissed ${importedIds.length} suggestions.` };
}
