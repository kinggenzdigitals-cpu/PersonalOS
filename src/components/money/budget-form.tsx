"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
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
import { upsertBudget, deleteBudget } from "@/app/(app)/money/planning-actions";
import type { Budget } from "@/lib/supabase/types";
import { toast } from "sonner";

export function BudgetForm({
  initial,
  usedCategoryIds = [],
  onDone,
}: {
  initial?: Budget;
  usedCategoryIds?: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const { expenseCategories } = useReference();
  const currency = useCurrency();
  const editing = Boolean(initial);

  const [categoryId, setCategoryId] = React.useState(
    initial?.category_id ?? "",
  );
  const [amount, setAmount] = React.useState(
    initial ? String(initial.amount) : "",
  );
  const [saving, setSaving] = React.useState(false);

  const available = expenseCategories.filter(
    (c) => c.id === initial?.category_id || !usedCategoryIds.includes(c.id),
  );

  async function save() {
    if (!categoryId) return toast.error("Pick a category.");
    const value = Number.parseFloat(amount);
    if (!(value > 0)) return toast.error("Enter a budget amount.");

    setSaving(true);
    const result = await upsertBudget({
      id: initial?.id,
      categoryId,
      amount: value,
    });
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(editing ? "Budget updated" : "Budget set");
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    const result = await deleteBudget(initial.id);
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Budget removed");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select
          value={categoryId}
          onValueChange={setCategoryId}
          disabled={editing}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {available.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="budget-amount">Monthly budget</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {currencySymbol(currency)}
          </span>
          <Input
            id="budget-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            className="pl-7 tnum"
          />
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
          {editing ? "Save changes" : "Set budget"}
        </Button>
      </div>
    </div>
  );
}
