"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LedgerDirection } from "@/lib/supabase/types";

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

export type LedgerInput = {
  direction: LedgerDirection;
  party: string;
  amount: number;
  dueDate: string | null;
  notes?: string | null;
};

export async function upsertLedgerEntry(
  input: LedgerInput & { id?: string },
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.party.trim()) return { ok: false, error: "Enter a name." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };

  const row = {
    direction: input.direction,
    party: input.party.trim(),
    amount: input.amount,
    due_date: input.dueDate,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("ledger_entries")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("ledger_entries")
    .insert({ user_id: user.id, status: "open", ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function deleteLedgerEntry(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase
    .from("ledger_entries")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/**
 * Settle a ledger entry: create the matching money transaction
 * (income for a receivable, expense for a payable), link it, and mark settled.
 */
export async function settleLedgerEntry(input: {
  id: string;
  amount: number;
  accountId: string;
  occurredAt?: string;
}): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };
  if (!input.accountId) return { ok: false, error: "Choose an account." };

  const { data: entry, error: entryErr } = await supabase
    .from("ledger_entries")
    .select("*")
    .eq("id", input.id)
    .single();
  if (entryErr || !entry) {
    return { ok: false, error: entryErr?.message ?? "Entry not found." };
  }

  const txType = entry.direction === "receivable" ? "income" : "expense";

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: txType,
      amount: input.amount,
      account_id: input.accountId,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      merchant: entry.party,
      notes:
        entry.direction === "receivable"
          ? `Received from ${entry.party}`
          : `Paid to ${entry.party}`,
    })
    .select("id")
    .single();
  if (txErr) return { ok: false, error: txErr.message };

  const { error: updErr } = await supabase
    .from("ledger_entries")
    .update({
      status: "settled",
      settled_at: new Date().toISOString(),
      settled_transaction_id: tx.id,
      account_id: input.accountId,
    })
    .eq("id", input.id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidate();
  return { ok: true, id: tx.id };
}
