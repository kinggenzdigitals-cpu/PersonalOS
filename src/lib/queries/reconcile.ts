import { createClient } from "@/lib/supabase/server";
import {
  assignMatches,
  MAX_DAYS_APART,
  type Candidate,
  type ScoredMatch,
} from "@/lib/reconcile";
import type { Category, Transaction } from "@/lib/supabase/types";

export type ReconcileItem = {
  imported: Transaction;
  match: ScoredMatch;
  importedCategory: string | null;
  candidateCategory: string | null;
};

export type ReconcileSummary = {
  items: ReconcileItem[];
  /** Imported rows reviewed-and-kept or with no candidate at all. */
  unmatchedCount: number;
  pendingCount: number;
};

function toCandidate(t: Transaction): Candidate {
  return {
    id: t.id,
    amount: Number(t.amount),
    date: new Date(t.occurred_at).toISOString().slice(0, 10),
    merchant: t.merchant ?? "",
    type: t.type,
    accountId: t.account_id,
  };
}

/**
 * Imported transactions that look like they duplicate something already
 * entered by hand. Only unreviewed imported rows are considered, so a pair the
 * user deliberately kept never comes back.
 *
 * Nothing here writes; the user confirms every resolution.
 */
export async function getReconciliation(
  limit = 50,
): Promise<ReconcileSummary> {
  const supabase = await createClient();

  const { data: imported, error } = await supabase
    .from("transactions")
    .select("*")
    .not("import_fingerprint", "is", null)
    .is("reconciled_at", null)
    .order("occurred_at", { ascending: false })
    .limit(limit)
    .returns<Transaction[]>();

  // Table/column not migrated yet, or nothing imported.
  if (error || !imported || imported.length === 0) {
    return { items: [], unmatchedCount: 0, pendingCount: 0 };
  }

  // Only look at manual rows in the date window the matcher could accept.
  const dates = imported.map((t) => new Date(t.occurred_at).getTime());
  const pad = (MAX_DAYS_APART + 1) * 86_400_000;
  const from = new Date(Math.min(...dates) - pad).toISOString();
  const to = new Date(Math.max(...dates) + pad).toISOString();

  // Narrow the candidate set to the exact amounts present in the imported
  // rows. Without this the query is unbounded and PostgREST's default row cap
  // truncates it in arbitrary order, so matches are missed nondeterministically
  // for anyone with a long history.
  const amounts = [...new Set(imported.map((t) => Number(t.amount)))];

  const [{ data: manual }, { data: categories }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .is("import_fingerprint", null)
      .is("reconciled_at", null)
      .in("amount", amounts)
      .gte("occurred_at", from)
      .lte("occurred_at", to)
      .order("occurred_at", { ascending: false })
      .limit(1000)
      .returns<Transaction[]>(),
    supabase.from("categories").select("*").returns<Category[]>(),
  ]);

  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const manualById = new Map((manual ?? []).map((t) => [t.id, t]));
  const candidates = (manual ?? []).map(toCandidate);

  // Exclusive pairing: each manual row may back at most one suggestion, or
  // confirming several pairs in turn would delete several real transactions
  // against a single hand-entered one.
  const paired = assignMatches(
    imported.map((t) => ({ id: t.id, tx: t, candidate: toCandidate(t) })),
    candidates,
  );

  const items: ReconcileItem[] = paired.map(({ item, match }) => {
    const other = manualById.get(match.candidate.id);
    return {
      imported: item.tx,
      match,
      importedCategory: item.tx.category_id
        ? (catName.get(item.tx.category_id) ?? null)
        : null,
      candidateCategory: other?.category_id
        ? (catName.get(other.category_id) ?? null)
        : null,
    };
  });

  items.sort((a, b) => b.match.score - a.match.score);

  return {
    items,
    unmatchedCount: imported.length - items.length,
    pendingCount: items.length,
  };
}
