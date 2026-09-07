"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissing, migrationRequired } from "@/lib/supabase/errors";

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
    .select("id, import_fingerprint")
    .in("id", [input.importedId, input.manualId])
    .returns<{ id: string; import_fingerprint: string | null }[]>();

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

  const deleteId =
    input.keep === "imported" ? input.manualId : input.importedId;
  const keepId = input.keep === "imported" ? input.importedId : input.manualId;

  const { error: delErr } = await supabase
    .from("transactions")
    .delete()
    .eq("id", deleteId);
  if (delErr) return { ok: false, error: delErr.message };

  // Mark the survivor reviewed. If we kept the manual row it has no
  // fingerprint, so this simply stops it being offered again.
  await supabase
    .from("transactions")
    .update({ reconciled_at: new Date().toISOString() })
    .eq("id", keepId);

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
