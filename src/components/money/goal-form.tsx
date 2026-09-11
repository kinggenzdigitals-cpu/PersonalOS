"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/providers/profile-provider";
import { currencySymbol } from "@/lib/format";
import { Money } from "@/components/ui/money";
import { sinkingFundMath } from "@/lib/sinking-funds";
import {
  upsertSavingsGoal,
  deleteSavingsGoal,
} from "@/app/(app)/money/goals-actions";
import type { SavingsGoal } from "@/lib/supabase/types";
import { toast } from "sonner";
import { useUpgrade } from "@/components/providers/upgrade-provider";

export const GOAL_COLORS = [
  "#168cff",
  "#38b6ff",
  "#63e875",
  "#54e76f",
  "#7bc73f",
  "#ffc24a",
  "#9db4d2",
  "#72ceff",
];

export function GoalForm({
  initial,
  onDone,
  todayKey,
}: {
  initial?: SavingsGoal;
  onDone: () => void;
  /** Today as YYYY-MM-DD in the user's timezone — enables the monthly hint. */
  todayKey?: string;
}) {
  const router = useRouter();
  const { notify } = useUpgrade();
  const currency = useCurrency();
  const editing = Boolean(initial);

  const [name, setName] = React.useState(initial?.name ?? "");
  const [target, setTarget] = React.useState(
    initial ? String(initial.target_amount) : "",
  );
  const [saved, setSaved] = React.useState(
    initial ? String(initial.saved_amount) : "",
  );
  const [targetDate, setTargetDate] = React.useState(
    initial?.target_date ?? "",
  );
  const [color, setColor] = React.useState(initial?.color ?? GOAL_COLORS[0]);
  const [saving, setSaving] = React.useState(false);

  // Live "set aside per month" hint for a dated goal (a sinking fund).
  const targetNum = Number.parseFloat(target) || 0;
  const hint =
    todayKey && targetDate && targetNum > 0
      ? sinkingFundMath(
          {
            target_amount: targetNum,
            saved_amount: Number.parseFloat(saved) || 0,
            target_date: targetDate,
          },
          todayKey,
        )
      : null;

  async function save() {
    if (!name.trim()) return toast.error("Name the goal.");
    const targetVal = Number.parseFloat(target);
    if (!(targetVal > 0)) return toast.error("Enter a target amount.");

    setSaving(true);
    const result = await upsertSavingsGoal({
      id: initial?.id,
      name,
      targetAmount: targetVal,
      savedAmount: Number.parseFloat(saved) || 0,
      color,
      targetDate: targetDate || null,
    });
    if (!result.ok) {
      notify(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(editing ? "Goal updated" : "Goal added");
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    const result = await deleteSavingsGoal(initial.id);
    if (!result.ok) {
      notify(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Goal removed");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="goal-name">Goal</Label>
        <Input
          id="goal-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Emergency fund, Vacation"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="goal-target">Target</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              {currencySymbol(currency)}
            </span>
            <Input
              id="goal-target"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              className="pl-7 tnum"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-saved">Saved so far</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              {currencySymbol(currency)}
            </span>
            <Input
              id="goal-saved"
              inputMode="decimal"
              value={saved}
              onChange={(e) => setSaved(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              className="pl-7 tnum"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="goal-date">Target date (optional)</Label>
        <Input
          id="goal-date"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="tnum"
        />
        <p className="text-xs text-muted-foreground">
          {hint ? (
            hint.reached ? (
              "Already reached."
            ) : hint.overdue ? (
              "Target date has passed — pick a new date to re-plan."
            ) : (
              <>
                Set aside about{" "}
                <span className="font-medium text-foreground">
                  <Money value={hint.requiredMonthly} currency={currency} />
                </span>
                /month for {hint.monthsLeft} month
                {hint.monthsLeft === 1 ? "" : "s"} to hit this on time.
              </>
            )
          ) : (
            "Add a date to turn this into a sinking fund with a monthly amount."
          )}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {GOAL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={cn(
                "grid size-7 place-items-center rounded-full transition-transform hover:scale-110",
                color === c && "ring-2 ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: c, ...(color === c ? { boxShadow: `0 0 0 2px ${c}` } : {}) }}
            >
              {color === c && <CheckIcon className="size-3.5 text-white" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        {editing && (
          <Button
            type="button"
            variant="ghost"
            className="text-error hover:text-error"
            onClick={remove}
            disabled={saving}
          >
            <Trash2Icon className="size-4" />
          </Button>
        )}
        <Button className="flex-1" onClick={save} disabled={saving}>
          {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
          {editing ? "Save changes" : "Add goal"}
        </Button>
      </div>
    </div>
  );
}
