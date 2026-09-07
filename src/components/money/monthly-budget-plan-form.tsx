"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormSheet } from "@/components/money/form-sheet";
import { useCurrency } from "@/components/providers/profile-provider";
import { useUpgrade } from "@/components/providers/upgrade-provider";
import { currencySymbol } from "@/lib/format";
import { upsertMonthlyBudgetPlan } from "@/app/(app)/money/planning-actions";
import type { MonthlyBudgetPlan } from "@/lib/supabase/types";

export function MonthlyBudgetPlanButton({
  monthStart,
  plan,
}: {
  monthStart: string;
  plan: MonthlyBudgetPlan | null;
}) {
  return (
    <FormSheet
      title={plan ? "Edit monthly plan" : "Set monthly plan"}
      description="Set the complete amount you can spend and save for this month."
      trigger={
        <Button size="sm" variant={plan ? "outline" : "default"}>
          <PencilIcon className="size-3.5" /> {plan ? "Edit plan" : "Set plan"}
        </Button>
      }
    >
      {(close) => (
        <MonthlyBudgetPlanForm
          monthStart={monthStart}
          plan={plan}
          onDone={close}
        />
      )}
    </FormSheet>
  );
}

function MonthlyBudgetPlanForm({
  monthStart,
  plan,
  onDone,
}: {
  monthStart: string;
  plan: MonthlyBudgetPlan | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const { notify } = useUpgrade();
  const currency = useCurrency();
  const [totalBudget, setTotalBudget] = React.useState(
    plan ? String(plan.total_budget) : "",
  );
  const [expectedIncome, setExpectedIncome] = React.useState(
    plan ? String(plan.expected_income) : "",
  );
  const [carryOver, setCarryOver] = React.useState(
    plan?.carry_over_enabled ?? true,
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    const total = Number.parseFloat(totalBudget) || 0;
    const income = Number.parseFloat(expectedIncome) || 0;
    if (!(total > 0)) return toast.error("Enter your total monthly budget.");

    setSaving(true);
    const result = await upsertMonthlyBudgetPlan({
      monthStart,
      totalBudget: total,
      expectedIncome: income,
      carryOverEnabled: carryOver,
    });
    if (!result.ok) {
      notify(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Monthly plan saved");
  }

  return (
    <div className="space-y-4">
      <MoneyField
        id="total-monthly-budget"
        label="Total monthly budget"
        value={totalBudget}
        onChange={setTotalBudget}
        currency={currency}
        placeholder="e.g. 40000"
      />
      <MoneyField
        id="expected-monthly-income"
        label="Expected income"
        value={expectedIncome}
        onChange={setExpectedIncome}
        currency={currency}
        placeholder="Optional"
      />

      <div className="flex items-start justify-between gap-4 rounded-xl bg-secondary/60 p-3">
        <div>
          <Label htmlFor="carry-over">Carry unused allotments forward</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Adds last month&apos;s unused category amount to this month.
          </p>
        </div>
        <Switch
          id="carry-over"
          checked={carryOver}
          onCheckedChange={setCarryOver}
          aria-label="Carry unused allotments forward"
        />
      </div>

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        Save monthly plan
      </Button>
    </div>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  currency,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          {currencySymbol(currency)}
        </span>
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(event) =>
            onChange(event.target.value.replace(/[^0-9.]/g, ""))
          }
          placeholder={placeholder}
          className="pl-7 tnum"
        />
      </div>
    </div>
  );
}
