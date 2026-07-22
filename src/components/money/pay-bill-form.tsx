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
import { markBillPaid } from "@/app/(app)/money/planning-actions";
import type { Bill } from "@/lib/supabase/types";
import { toast } from "sonner";

export function PayBillForm({
  bill,
  onDone,
}: {
  bill: Bill;
  onDone: () => void;
}) {
  const router = useRouter();
  const { accounts } = useReference();
  const currency = useCurrency();

  const [amount, setAmount] = React.useState(String(bill.amount));
  const [accountId, setAccountId] = React.useState(
    bill.account_id ?? accounts[0]?.id ?? "",
  );
  const [saving, setSaving] = React.useState(false);

  async function pay() {
    const value = Number.parseFloat(amount);
    if (!(value > 0)) return toast.error("Enter an amount.");
    if (!accountId) return toast.error("Choose an account.");

    setSaving(true);
    const result = await markBillPaid({
      billId: bill.id,
      amount: value,
      accountId,
      paidForDate: bill.next_due_date,
    });
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(`${bill.name} marked paid`);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This records an expense from the account below and moves the due date to
        the next cycle.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="pay-amount">Amount</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {currencySymbol(currency)}
          </span>
          <Input
            id="pay-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="pl-7 tnum"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Pay from</Label>
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

      <Button className="w-full" onClick={pay} disabled={saving}>
        {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        Confirm payment
      </Button>
    </div>
  );
}
