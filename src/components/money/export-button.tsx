"use client";

import * as React from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReference } from "@/components/providers/reference-provider";
import { fetchTransactionsAction } from "@/app/(app)/money/actions";
import { toast } from "sonner";

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function ExportButton() {
  const { accounts, categories } = useReference();
  const [busy, setBusy] = React.useState(false);

  async function exportCsv() {
    setBusy(true);
    try {
      const txns = await fetchTransactionsAction({ limit: 100000, offset: 0 });
      const accountName = new Map(accounts.map((a) => [a.id, a.name]));
      const categoryName = new Map(categories.map((c) => [c.id, c.name]));

      const header = [
        "Date",
        "Type",
        "Amount",
        "Category",
        "Account",
        "To account",
        "Merchant",
        "Notes",
      ];
      const rows = txns.map((t) => [
        new Date(t.occurred_at).toISOString().slice(0, 10),
        t.type,
        String(t.amount),
        t.category_id ? (categoryName.get(t.category_id) ?? "") : "",
        accountName.get(t.account_id) ?? "",
        t.to_account_id ? (accountName.get(t.to_account_id) ?? "") : "",
        t.merchant ?? "",
        t.notes ?? "",
      ]);

      const csv = [header, ...rows]
        .map((r) => r.map((c) => csvEscape(String(c))).join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `life-os-transactions-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${txns.length} transactions`);
    } catch {
      toast.error("Couldn't export right now. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={exportCsv} disabled={busy}>
      {busy ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : (
        <DownloadIcon className="size-4" aria-hidden />
      )}
      Export transactions (CSV)
    </Button>
  );
}
