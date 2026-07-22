"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReference } from "@/components/providers/reference-provider";
import { useCurrency } from "@/components/providers/profile-provider";
import { currencySymbol } from "@/lib/format";
import { settleLedgerEntry } from "@/app/(app)/money/ledger-actions";
import type { LedgerEntry } from "@/lib/supabase/types";
import { toast } from "sonner";

export function SettleLedgerForm({
  entry,
  onDone,
}: {
  entry: LedgerEntry;
  onDone: () => void;
}) {
  const router = useRouter();
  const { accounts } = useReference();
  const currency = useCurrency();
  const receivable = entry.direction === "receivable";

  const [amount, setAmount] = React.useState(String(entry.amount));
  const [accountId, setAccountId] = React.useState(
    entry.account_id ?? accounts[0]?.id ?? "",
  );
  const [saving, setSaving] = React.useState(false);

  async function settle() {
    const value = Number.parseFloat(amount);
    if (!(value > 0)) return toast.error("Enter an amount.");
    if (!accountId) return toast.error("Choose an account.");

    setSaving(true);
    const result = await settleLedgerEntry({
      id: entry.id,
      amount: value,
      accountId,
    });
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(receivable ? "Marked received" : "Marked paid");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {receivable
          ? `This records income from ${entry.party} into the account below.`
          : `This records an expense to ${entry.party} from the account below.`}
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="settle-amount">Amount</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {currencySymbol(currency)}
          </span>
          <Input
            id="settle-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="pl-7 tnum"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{receivable ? "Deposit to" : "Pay from"}</Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button className="w-full" onClick={settle} disabled={saving}>
        {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        {receivable ? "Confirm received" : "Confirm paid"}
      </Button>
    </div>
  );
}
