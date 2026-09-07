"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
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
import { FormSheet } from "@/components/money/form-sheet";
import { useCurrency } from "@/components/providers/profile-provider";
import { useUpgrade } from "@/components/providers/upgrade-provider";
import { currencySymbol } from "@/lib/format";
import {
  deleteMonthlyGoalAllocation,
  upsertMonthlyGoalAllocation,
} from "@/app/(app)/money/planning-actions";
import type {
  MonthlyGoalAllocation,
  SavingsGoal,
} from "@/lib/supabase/types";

export function SavingsAllocationButton({
  monthStart,
  goals,
  usedGoalIds,
  initial,
  trigger,
}: {
  monthStart: string;
  goals: SavingsGoal[];
  usedGoalIds: string[];
  initial?: MonthlyGoalAllocation;
  trigger?: React.ReactNode;
}) {
  return (
    <FormSheet
      title={initial ? "Edit savings allotment" : "Add savings allotment"}
      description="Savings is reserved before optional spending."
      trigger={
        trigger ?? (
          <Button variant="outline" size="sm">
            <PlusIcon className="size-3.5" /> Add savings
          </Button>
        )
      }
    >
      {(close) => (
        <SavingsAllocationForm
          monthStart={monthStart}
          goals={goals}
          usedGoalIds={usedGoalIds}
          initial={initial}
          onDone={close}
        />
      )}
    </FormSheet>
  );
}

function SavingsAllocationForm({
  monthStart,
  goals,
  usedGoalIds,
  initial,
  onDone,
}: {
  monthStart: string;
  goals: SavingsGoal[];
  usedGoalIds: string[];
  initial?: MonthlyGoalAllocation;
  onDone: () => void;
}) {
  const router = useRouter();
  const { notify } = useUpgrade();
  const currency = useCurrency();
  const [goalId, setGoalId] = React.useState(initial?.goal_id ?? "");
  const [amount, setAmount] = React.useState(
    initial ? String(initial.amount) : "",
  );
  const [saving, setSaving] = React.useState(false);
  const available = goals.filter(
    (goal) => goal.id === initial?.goal_id || !usedGoalIds.includes(goal.id),
  );

  async function save() {
    const value = Number.parseFloat(amount);
    if (!goalId) return toast.error("Choose a savings goal.");
    if (!(value > 0)) return toast.error("Enter an allotment amount.");
    setSaving(true);
    const result = await upsertMonthlyGoalAllocation({
      id: initial?.id,
      monthStart,
      goalId,
      amount: value,
    });
    if (!result.ok) {
      notify(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(initial ? "Savings allotment updated" : "Savings allotted");
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    const result = await deleteMonthlyGoalAllocation(initial.id);
    if (!result.ok) {
      notify(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Savings allotment removed");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Savings goal or sinking fund</Label>
        <Select
          value={goalId}
          disabled={Boolean(initial)}
          onValueChange={(value) => {
            setGoalId(value);
            const goal = goals.find((item) => item.id === value);
            if (!amount && goal?.monthly_target) {
              setAmount(String(goal.monthly_target));
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a goal" />
          </SelectTrigger>
          <SelectContent>
            {available.map((goal) => (
              <SelectItem key={goal.id} value={goal.id}>
                {goal.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="savings-allotment">Required this month</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {currencySymbol(currency)}
          </span>
          <Input
            id="savings-allotment"
            inputMode="decimal"
            value={amount}
            onChange={(event) =>
              setAmount(event.target.value.replace(/[^0-9.]/g, ""))
            }
            placeholder="0.00"
            className="pl-7 tnum"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        {initial && (
          <Button
            variant="ghost"
            className="text-error hover:text-error"
            onClick={remove}
            disabled={saving}
          >
            <Trash2Icon className="size-4" />
          </Button>
        )}
        <Button className="flex-1" onClick={save} disabled={saving}>
          {saving && <Loader2Icon className="size-4 animate-spin" />}
          {initial ? "Save changes" : "Add allotment"}
        </Button>
      </div>
    </div>
  );
}
