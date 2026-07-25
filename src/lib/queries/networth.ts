import { createClient } from "@/lib/supabase/server";
import { getAccountsWithBalances } from "@/lib/queries/money";
import { getLedgerSummary } from "@/lib/queries/ledger";
import type { Asset, Liability } from "@/lib/supabase/types";

export type NetWorth = {
  liquid: number; // sum of account balances
  assets: Asset[];
  assetsTotal: number;
  liabilities: Liability[];
  liabilitiesTotal: number;
  receivable: number;
  payable: number;
  netWorth: number;
};

export async function getNetWorth(timezone: string): Promise<NetWorth> {
  const supabase = await createClient();

  const [accounts, ledger, { data: assets }, { data: liabilities }] =
    await Promise.all([
      getAccountsWithBalances(false),
      getLedgerSummary(timezone),
      supabase
        .from("assets")
        .select("*")
        .order("sort_order")
        .returns<Asset[]>(),
      supabase
        .from("liabilities")
        .select("*")
        .order("sort_order")
        .returns<Liability[]>(),
    ]);

  const liquid = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const assetsTotal = (assets ?? []).reduce((s, a) => s + Number(a.value), 0);
  const liabilitiesTotal = (liabilities ?? []).reduce(
    (s, l) => s + Number(l.balance),
    0,
  );

  const netWorth =
    liquid +
    assetsTotal +
    ledger.totalReceivable -
    ledger.totalPayable -
    liabilitiesTotal;

  return {
    liquid,
    assets: assets ?? [],
    assetsTotal,
    liabilities: liabilities ?? [],
    liabilitiesTotal,
    receivable: ledger.totalReceivable,
    payable: ledger.totalPayable,
    netWorth,
  };
}
