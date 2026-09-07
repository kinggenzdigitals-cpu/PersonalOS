"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid, isValidBalance, validComparison, type BalancePreview, type SaveComparisonInput } from "@/lib/reconciliation";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; restart?: boolean };

export async function previewAccountBalance(accountId: string, observedBalance: number): Promise<Result<BalancePreview>> {
  if (!isUuid(accountId) || !isValidBalance(observedBalance)) {
    return { ok: false, error: "Choose an account and enter a balance with up to two decimals." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to compare balances." };
  const asOf = new Date().toISOString();
  const { data, error } = await supabase.rpc("get_recorded_account_balance", {
    p_account_id: accountId, p_as_of: asOf,
  });
  if (error || data === null || !isValidBalance(Number(data))) {
    return { ok: false, error: "This balance couldn't be checked. Please try again later." };
  }
  const recordedBalance = Number(data);
  return { ok: true, data: {
    requestId: crypto.randomUUID(), accountId, asOf, recordedBalance, observedBalance,
    difference: Math.round((observedBalance - recordedBalance) * 100) / 100,
  } };
}

export async function saveAccountComparison(input: SaveComparisonInput): Promise<Result<{ status: string }>> {
  if (!validComparison(input)) return { ok: false, error: "Compare the balance again before saving.", restart: true };
  if (input.applyAdjustment && input.recordedBalance !== input.observedBalance && !input.notes.trim()) {
    return { ok: false, error: "Add a reason for the adjustment." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to save this comparison." };
  const { data, error } = await supabase.rpc("record_account_reconciliation", {
    p_request_id: input.requestId, p_account_id: input.accountId, p_as_of: input.asOf,
    p_expected_balance: input.recordedBalance, p_observed_balance: input.observedBalance,
    p_apply_adjustment: input.applyAdjustment, p_notes: input.notes.trim() || null,
  });
  if (error || !data) {
    if (error?.message === "Recorded balance changed. Compare again" || error?.message === "Preview expired. Compare again") {
      return { ok: false, error: "Your balance changed or the preview expired. Compare again.", restart: true };
    }
    return { ok: false, error: "The comparison couldn't be saved. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { status: data.status } };
}
