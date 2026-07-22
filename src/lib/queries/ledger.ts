import { createClient } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/date";
import type { LedgerDirection, LedgerEntry } from "@/lib/supabase/types";

export type LedgerSummary = {
  totalReceivable: number;
  overdueReceivable: number;
  totalPayable: number;
  overduePayable: number;
};

export async function getLedgerSummary(
  timezone: string,
): Promise<LedgerSummary> {
  const supabase = await createClient();
  const today = localDateKey(timezone);

  const { data } = await supabase
    .from("ledger_entries")
    .select("direction, amount, due_date, status")
    .eq("status", "open")
    .returns<
      Pick<LedgerEntry, "direction" | "amount" | "due_date" | "status">[]
    >();

  const rows = data ?? [];
  const sum = (
    dir: LedgerDirection,
    overdueOnly: boolean,
  ) =>
    rows
      .filter(
        (r) =>
          r.direction === dir &&
          (!overdueOnly || (r.due_date != null && r.due_date < today)),
      )
      .reduce((s, r) => s + Number(r.amount), 0);

  return {
    totalReceivable: sum("receivable", false),
    overdueReceivable: sum("receivable", true),
    totalPayable: sum("payable", false),
    overduePayable: sum("payable", true),
  };
}

export async function getLedgerEntries(
  direction?: LedgerDirection,
  includeSettled = false,
): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("ledger_entries")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (direction) query = query.eq("direction", direction);
  if (!includeSettled) query = query.eq("status", "open");

  const { data } = await query.returns<LedgerEntry[]>();
  return data ?? [];
}
