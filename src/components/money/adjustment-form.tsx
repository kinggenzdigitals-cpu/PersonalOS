"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useReference } from "@/components/providers/reference-provider";
import { useCurrency } from "@/components/providers/profile-provider";
import { MoneyAmountInput } from "@/components/money/money-amount-input";
import { createAdjustment } from "@/app/(app)/money/actions";
import type { AdjustmentDirection } from "@/lib/supabase/types";
import { toast } from "sonner";

export function AdjustmentForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { accounts } = useReference();
  const currency = useCurrency();

  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [direction, setDirection] = React.useState<AdjustmentDirection>("in");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    const value = Number.parseFloat(amount);
    if (!(value > 0)) return toast.error("Enter an amount.");
    if (!accountId) return toast.error("Choose an account.");

    setSaving(true);
    const result = await createAdjustment({
      accountId,
      direction,
      amount: value,
      occurredAt: new Date().toISOString(),
      notes: notes || null,
    });
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Balance adjusted");
  }

  return (
    <div className="space-y-4">
      <MoneyAmountInput value={amount} onChange={setAmount} currency={currency} />

      <div className="grid grid-cols-2 gap-2">
        {(["in", "out"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            aria-pressed={direction === d}
            className={cn(
              "rounded-xl border py-2 text-sm font-medium transition-colors",
              direction === d
                ? d === "in"
                  ? "border-success bg-success/10 text-success"
                  : "border-error bg-error/10 text-error"
                : "border-border text-muted-foreground hover:border-brand/40",
            )}
          >
            {d === "in" ? "Add to balance" : "Remove from balance"}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>Account</Label>
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

      <div className="space-y-1.5">
        <Label htmlFor="adj-notes">Reason (optional)</Label>
        <Textarea
          id="adj-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Reconciling to actual cash on hand"
          rows={2}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Adjustments reconcile an account to reality without appearing in income
        or expense reports.
      </p>

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        Save adjustment
      </Button>
    </div>
  );
}
