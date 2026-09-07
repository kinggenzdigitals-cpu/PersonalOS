"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, LayoutTemplateIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSheet } from "@/components/money/form-sheet";
import { useUpgrade } from "@/components/providers/upgrade-provider";
import { BUDGET_TEMPLATES } from "@/lib/budget-templates";
import {
  applyBudgetTemplate,
  copyPreviousMonthPlan,
} from "@/app/(app)/money/planning-actions";
import type { SavingsGoal } from "@/lib/supabase/types";

export function BudgetTemplatePicker({
  monthStart,
  totalBudget,
  goals,
}: {
  monthStart: string;
  totalBudget: number;
  goals: SavingsGoal[];
}) {
  const router = useRouter();
  const { notify } = useUpgrade();
  const [selected, setSelected] = React.useState(BUDGET_TEMPLATES[0].id);
  const [savingsGoalId, setSavingsGoalId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  return (
    <FormSheet
      title="Budget templates"
      description="For an empty month only. Existing allotments are never overwritten."
      trigger={
        <Button variant="outline" size="sm">
          <LayoutTemplateIcon className="size-3.5" /> Templates
        </Button>
      }
    >
      {(close) => (
        <div className="space-y-4">
          <div className="space-y-2">
            {BUDGET_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelected(template.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selected === template.id
                    ? "border-brand bg-brand/5"
                    : "border-border hover:bg-secondary/60"
                }`}
              >
                <span className="font-medium">{template.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {template.description}
                </span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  {template.categories
                    .map((item) => `${item.name} ${item.percent}%`)
                    .join(" · ")}
                </span>
              </button>
            ))}
          </div>
          {goals.length > 0 && (
            <div className="space-y-1.5">
              <Label>Put the savings reserve into</Label>
              <Select value={savingsGoalId} onValueChange={setSavingsGoalId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a goal (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {goals.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="rounded-lg bg-secondary/60 p-2.5 text-xs text-muted-foreground">
            {goals.length > 0
              ? "If no goal is selected, the savings percentage stays unallocated."
              : "Create a savings goal to assign the template's savings percentage."}
          </p>
          <Button
            className="w-full"
            disabled={saving || totalBudget <= 0}
            onClick={async () => {
              if (totalBudget <= 0) return toast.error("Set your monthly plan first.");
              setSaving(true);
              const result = await applyBudgetTemplate({
                monthStart,
                totalBudget,
                templateId: selected,
                savingsGoalId: savingsGoalId || undefined,
              });
              if (!result.ok) {
                notify(result.error);
                setSaving(false);
                return;
              }
              close();
              router.refresh();
              toast.success("Template applied");
            }}
          >
            {saving && <Loader2Icon className="size-4 animate-spin" />}
            Apply template
          </Button>
        </div>
      )}
    </FormSheet>
  );
}

export function CopyPreviousMonthButton({ monthStart }: { monthStart: string }) {
  const router = useRouter();
  const { notify } = useUpgrade();
  const [saving, setSaving] = React.useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={saving}
      onClick={async () => {
        setSaving(true);
        const result = await copyPreviousMonthPlan(monthStart);
        if (!result.ok) {
          notify(result.error);
          setSaving(false);
          return;
        }
        router.refresh();
        toast.success("Previous month copied");
        setSaving(false);
      }}
    >
      {saving ? (
        <Loader2Icon className="size-3.5 animate-spin" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
      Copy last month
    </Button>
  );
}
