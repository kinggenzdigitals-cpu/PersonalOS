"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSheet } from "@/components/money/form-sheet";
import { GoalForm } from "@/components/money/goal-form";
import { useCurrency } from "@/components/providers/profile-provider";
import { currencySymbol, formatMoney } from "@/lib/format";
import { contributeToGoal } from "@/app/(app)/money/goals-actions";
import type { SavingsGoal } from "@/lib/supabase/types";
import { toast } from "sonner";

export function GoalCard({ goal }: { goal: SavingsGoal }) {
  const currency = useCurrency();
  const color = goal.color ?? "var(--brand)";
  const target = Number(goal.target_amount);
  const saved = Number(goal.saved_amount);
  const pct = target > 0 ? Math.round((saved / target) * 100) : 0;
  const done = saved >= target;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <FormSheet
          title="Edit goal"
          trigger={
            <button type="button" className="min-w-0 flex-1 text-left">
              <span className="flex items-center gap-2 font-medium">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate">{goal.name}</span>
              </span>
            </button>
          }
        >
          {(close) => <GoalForm initial={goal} onDone={close} />}
        </FormSheet>
        <span className="tnum shrink-0 text-sm text-muted-foreground">
          {formatMoney(saved, currency)} / {formatMoney(target, currency)}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span
          className="tnum text-xs font-medium"
          style={{ color: done ? "var(--success)" : color }}
        >
          {done ? "Reached! 🎉" : `${pct}%`}
        </span>
        <ContributeButton goal={goal} />
      </div>
    </div>
  );
}

function ContributeButton({ goal }: { goal: SavingsGoal }) {
  const router = useRouter();
  const currency = useCurrency();
  const [amount, setAmount] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  return (
    <FormSheet
      title={`Add funds to ${goal.name}`}
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/15"
        >
          <PlusIcon className="size-3.5" /> Add funds
        </button>
      }
    >
      {(close) => (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contrib">Amount to add</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                {currencySymbol(currency)}
              </span>
              <Input
                id="contrib"
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="0.00"
                className="pl-7 tnum"
                autoFocus
              />
            </div>
          </div>
          <Button
            className="w-full"
            disabled={saving}
            onClick={async () => {
              const val = Number.parseFloat(amount);
              if (!(val > 0)) return toast.error("Enter an amount.");
              setSaving(true);
              const res = await contributeToGoal(goal.id, val);
              if (!res.ok) {
                toast.error(res.error);
                setSaving(false);
                return;
              }
              close();
              router.refresh();
              toast.success("Funds added");
            }}
          >
            {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
            Add funds
          </Button>
        </div>
      )}
    </FormSheet>
  );
}
