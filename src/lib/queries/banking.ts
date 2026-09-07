import "server-only";
import { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/queries/all-rows";
import type { AccountReconciliation } from "@/lib/supabase/types";

export type ComparisonAccount = { id: string; name: string; type: string };

export async function getBankingWorkspace(): Promise<{
  accounts: ComparisonAccount[];
  history: AccountReconciliation[];
  available: boolean;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { accounts: [], history: [], available: false };
  try {
    const [accounts, history] = await Promise.all([
      allRows<ComparisonAccount>((from, to) => supabase.from("accounts")
        .select("id,name,type", { count: "exact" }).eq("user_id", user.id)
        .eq("archived", false).order("id").range(from, to), "Accounts are unavailable."),
      supabase.from("account_reconciliations").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).order("id").limit(20),
    ]);
    if (history.error) return { accounts, history: [], available: false };
    return { accounts, history: history.data ?? [], available: true };
  } catch {
    return { accounts: [], history: [], available: false };
  }
}
