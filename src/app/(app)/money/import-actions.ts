"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/plans";
import { getActivePlan } from "@/lib/queries/billing";
import { isSchemaMissing, migrationRequired } from "@/lib/supabase/errors";
import type { Transaction } from "@/lib/supabase/types";

export type ImportRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive
  type: "income" | "expense";
  categoryId: string | null;
  fingerprint: string;
  /** Bank reference number, stored in notes so a charge can be traced later. */
  reference?: string | null;
};

export type ImportResult =
  | {
      ok: true;
      imported: number;
      skippedDuplicates: number;
      batchId: string;
    }
  | { ok: false; error: string };

/** Guard: nobody imports a million rows in one go. */
const MAX_ROWS = 2000;

/**
 * Import a parsed statement.
 *
 * Notes on correctness:
 *  - The monthly transaction cap is checked ONCE for the whole batch. Calling
 *    the per-row create action would let an import stop halfway and leave a
 *    partially-imported statement.
 *  - Duplicates are skipped, not merged or overwritten, and the count is
 *    reported back. Re-importing the same file is therefore safe and visible.
 *  - Every amount and date is re-validated here; the client's parse is a
 *    convenience, never the authority.
 */
export async function importTransactions(input: {
  accountId: string;
  filename: string | null;
  rows: ImportRow[];
}): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  if (!input.accountId) return { ok: false, error: "Choose an account." };
  if (input.rows.length === 0) {
    return { ok: false, error: "There's nothing to import." };
  }
  if (input.rows.length > MAX_ROWS) {
    return {
      ok: false,
      error: `That file has ${input.rows.length} rows. Import at most ${MAX_ROWS} at a time.`,
    };
  }

  // The account must be the caller's own (RLS would reject the insert anyway,
  // but failing here gives a clear message instead of a constraint error).
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", input.accountId)
    .maybeSingle<{ id: string }>();
  if (!account) return { ok: false, error: "That account doesn't exist." };

  // Re-validate every row server-side.
  const clean: ImportRow[] = [];
  for (const r of input.rows) {
    const amount = Number(r.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    if (r.type !== "income" && r.type !== "expense") continue;
    clean.push({
      ...r,
      amount: Math.round((amount + Number.EPSILON) * 100) / 100,
      description: (r.description ?? "").slice(0, 200),
    });
  }
  if (clean.length === 0) {
    return { ok: false, error: "None of those rows could be read." };
  }

  // ---- Plan gate + cap, once for the whole batch --------------------------
  const plan = await getActivePlan();

  // The page also checks this, but a page-level check is a hint: this action
  // is directly POST-addressable and survives a downgrade.
  if (PLANS[plan].limits.csvExport !== true) {
    return {
      ok: false,
      error: `Statement import isn't included in your ${PLANS[plan].name} plan. Upgrade to unlock it.`,
    };
  }

  const limit = PLANS[plan].limits.transactionsPerMonth;
  if (typeof limit === "number") {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    // Counted on created_at, not occurred_at. Statement rows carry PAST dates,
    // so an occurred_at window would let a user import unlimited history a
    // month at a time without ever touching the cap.
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString());
    const used = count ?? 0;
    if (used + clean.length > limit) {
      const room = Math.max(0, limit - used);
      return {
        ok: false,
        error: `Your ${PLANS[plan].name} plan allows ${limit} transactions per month and you have room for ${room}. This file has ${clean.length}. Upgrade for a higher limit.`,
      };
    }
  }

  // ---- Skip rows already imported ----------------------------------------
  const fingerprints = clean.map((r) => r.fingerprint);
  const existing = new Set<string>();
  // Chunked: a long IN list can blow the URL length limit on PostgREST.
  for (let i = 0; i < fingerprints.length; i += 200) {
    const chunk = fingerprints.slice(i, i + 200);
    const { data, error } = await supabase
      .from("transactions")
      .select("import_fingerprint")
      .in("import_fingerprint", chunk)
      .returns<Pick<Transaction, "import_fingerprint">[]>();
    if (error) {
      if (isSchemaMissing(error)) {
        return { ok: false, error: migrationRequired("CSV import", "0020") };
      }
      return { ok: false, error: error.message };
    }
    for (const row of data ?? []) {
      if (row.import_fingerprint) existing.add(row.import_fingerprint);
    }
  }

  const toInsert = clean.filter((r) => !existing.has(r.fingerprint));
  const skippedDuplicates = clean.length - toInsert.length;

  if (toInsert.length === 0) {
    return {
      ok: false,
      error: `All ${clean.length} rows were already imported. Nothing to do.`,
    };
  }

  // ---- Record the batch, then the rows ------------------------------------
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      user_id: user.id,
      account_id: input.accountId,
      source: "csv",
      filename: input.filename?.slice(0, 200) ?? null,
      row_count: input.rows.length,
      imported_count: toInsert.length,
      skipped_count: skippedDuplicates,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    if (isSchemaMissing(batchError)) {
      return { ok: false, error: migrationRequired("CSV import", "0020") };
    }
    return {
      ok: false,
      error: batchError?.message ?? "Couldn't start the import.",
    };
  }

  const { error: insertError } = await supabase.from("transactions").insert(
    toInsert.map((r) => ({
      user_id: user.id,
      type: r.type,
      amount: r.amount,
      category_id: r.categoryId,
      account_id: input.accountId,
      // Noon local-ish; statements carry a date, not a time.
      occurred_at: new Date(`${r.date}T12:00:00Z`).toISOString(),
      merchant: r.description || null,
      notes: r.reference ? `Ref: ${r.reference}` : null,
      import_batch_id: batch.id,
      import_fingerprint: r.fingerprint,
    })),
  );

  if (insertError) {
    // Roll the batch row back so a failed import leaves no phantom record.
    await supabase.from("import_batches").delete().eq("id", batch.id);
    if (insertError.code === "23505") {
      return {
        ok: false,
        error:
          "Some of those rows were imported by another upload at the same time. Try again.",
      };
    }
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    imported: toInsert.length,
    skippedDuplicates,
    batchId: batch.id,
  };
}
