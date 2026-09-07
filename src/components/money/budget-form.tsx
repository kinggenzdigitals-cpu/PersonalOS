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
import { useUpgrade } from "@/components/providers/upgrade-provider";

const CUSTOM_CATEGORY = "__custom_category__";

export function BudgetForm({
  initial,
  monthStart,
  usedCategoryIds = [],
  onDone,
}: {
  initial?: Budget;
  monthStart: string;
  usedCategoryIds?: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const { notify } = useUpgrade();
  const { expenseCategories } = useReference();
  const currency = useCurrency();
  const editing = Boolean(initial);

  const [categoryId, setCategoryId] = React.useState(
    initial?.category_id ?? "",
  );
  const [customCategory, setCustomCategory] = React.useState("");
  const [amount, setAmount] = React.useState(
    initial ? String(initial.amount) : "",
  );
  const [saving, setSaving] = React.useState(false);

  const available = expenseCategories.filter(
    (c) => c.id === initial?.category_id || !usedCategoryIds.includes(c.id),
  );

  async function save() {
    if (!categoryId) return toast.error("Pick a category.");
    if (categoryId === CUSTOM_CATEGORY && !customCategory.trim()) {
      return toast.error("Name the custom category.");
    }
    const value = Number.parseFloat(amount);
    if (!(value > 0)) return toast.error("Enter a budget amount.");

    setSaving(true);
    const result = await upsertBudget({
      id: initial?.id,
      categoryId: categoryId === CUSTOM_CATEGORY ? "" : categoryId,
      customCategoryName:
        categoryId === CUSTOM_CATEGORY ? customCategory : undefined,
      amount: value,
      monthStart,
    });
    if (!result.ok) {
      notify(result.error);
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
      notify(result.error);
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
            {!editing && (
              <SelectItem value={CUSTOM_CATEGORY}>+ Custom category</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {categoryId === CUSTOM_CATEGORY && (
        <div className="space-y-1.5">
          <Label htmlFor="custom-budget-category">Custom category</Label>
          <Input
            id="custom-budget-category"
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value)}
            placeholder="e.g. Electricity, Internet, SSS"
            autoFocus
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="budget-amount">Monthly allotment</Label>
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
          {editing ? "Save changes" : "Add allotment"}
        </Button>
      </div>
    </div>
  );
}
