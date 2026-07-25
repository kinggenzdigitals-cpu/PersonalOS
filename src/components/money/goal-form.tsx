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
import {
  upsertSavingsGoal,
  deleteSavingsGoal,
} from "@/app/(app)/money/goals-actions";
import type { SavingsGoal } from "@/lib/supabase/types";
import { toast } from "sonner";

export const GOAL_COLORS = [
  "#C4643B",
  "#7C9082",
  "#6B7F9E",
  "#B08A4F",
  "#C77D8E",
  "#5B9AA0",
  "#9A7BB0",
  "#2F7D5C",
];

export function GoalForm({
  initial,
  onDone,
}: {
  initial?: SavingsGoal;
  onDone: () => void;
}) {
  const router = useRouter();
  const currency = useCurrency();
  const editing = Boolean(initial);

  const [name, setName] = React.useState(initial?.name ?? "");
  const [target, setTarget] = React.useState(
    initial ? String(initial.target_amount) : "",
  );
  const [saved, setSaved] = React.useState(
    initial ? String(initial.saved_amount) : "",
  );
  const [color, setColor] = React.useState(initial?.color ?? GOAL_COLORS[0]);
  const [saving, setSaving] = React.useState(false);

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
    });
    if (!result.ok) {
      toast.error(result.error);
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
      toast.error(result.error);
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
