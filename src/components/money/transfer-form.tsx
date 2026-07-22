"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { MoneyAmountInput } from "@/components/money/money-amount-input";
import { createTransfer } from "@/app/(app)/money/actions";
import { toast } from "sonner";

export function TransferForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { accounts } = useReference();
  const currency = useCurrency();

  const [amount, setAmount] = React.useState("");
  const [from, setFrom] = React.useState(accounts[0]?.id ?? "");
  const [to, setTo] = React.useState(accounts[1]?.id ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    const value = Number.parseFloat(amount);
    if (!(value > 0)) return toast.error("Enter an amount.");
    if (from === to) return toast.error("Pick two different accounts.");

    setSaving(true);
    const result = await createTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: value,
      occurredAt: new Date().toISOString(),
    });
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Transfer recorded");
  }

  return (
    <div className="space-y-4">
      <MoneyAmountInput value={amount} onChange={setAmount} currency={currency} />

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label>From</Label>
          <Select value={from} onValueChange={setFrom}>
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
        <ArrowRightIcon className="mb-2.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 space-y-1.5">
          <Label>To</Label>
          <Select value={to} onValueChange={setTo}>
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
      </div>

      <p className="text-xs text-muted-foreground">
        Transfers move money between your accounts. They never count as income
        or expense.
      </p>

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        Record transfer
      </Button>
    </div>
  );
}
