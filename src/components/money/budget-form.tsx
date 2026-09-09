"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { useReference } from "@/components/providers/reference-provider";
import { useCurrency } from "@/components/providers/profile-provider";
import { currencySymbol } from "@/lib/format";
import { upsertBudget, deleteBudget } from "@/app/(app)/money/planning-actions";
import { createCategory } from "@/app/(app)/money/actions";
import type { Budget, Category } from "@/lib/supabase/types";
import { toast } from "sonner";
import { useUpgrade } from "@/components/providers/upgrade-provider";

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
  const { notify } = useUpgrade();
  const { expenseCategories } = useReference();
  const currency = useCurrency();
  const editing = Boolean(initial);

  const [categoryId, setCategoryId] = React.useState(
    initial?.category_id ?? "",
  );
  const [amount, setAmount] = React.useState(
    initial ? String(initial.amount) : "",
  );
  const [carryover, setCarryover] = React.useState(
    initial?.carryover ?? false,
  );
  const [saving, setSaving] = React.useState(false);

  // A category created from inside this modal has to be selectable immediately.
  // ReferenceProvider is fed by the server layout, so it only learns about the
  // new row once router.refresh() completes — until then the option would not
  // exist and the field would render blank right after creating it.
  const [justCreated, setJustCreated] = React.useState<Category[]>([]);

  const available = React.useMemo(() => {
    const merged = [...expenseCategories];
    for (const c of justCreated) {
      if (!merged.some((m) => m.id === c.id)) merged.push(c);
    }
    // An existing budget already occupies its category; offering it again would
    // let the user try to create a second budget for the same one.
    return merged.filter(
      (c) => c.id === initial?.category_id || !usedCategoryIds.includes(c.id),
    );
  }, [expenseCategories, justCreated, usedCategoryIds, initial?.category_id]);

  const options = React.useMemo(
    () => available.map((c) => ({ value: c.id, label: c.name })),
    [available],
  );

  /**
   * Create-or-reuse. The action returns an EXISTING category when the typed name
   * normalises onto one, so "food" never mints a second "Food".
   */
  async function handleCreate(name: string): Promise<string | null> {
    const res = await createCategory(name, "expense");
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    setJustCreated((prev) =>
      prev.some((c) => c.id === res.category.id) ? prev : [...prev, res.category],
    );
    router.refresh();
    return res.category.id;
  }

  async function save() {
    if (!categoryId) return toast.error("Pick a category.");
    const value = Number.parseFloat(amount);
    if (!(value > 0)) return toast.error("Enter a budget amount.");

    setSaving(true);
    const result = await upsertBudget({
      id: initial?.id,
      categoryId,
      amount: value,
      carryover,
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
        <Label htmlFor="budget-category">Category</Label>
        <Combobox
          id="budget-category"
          options={options}
          value={categoryId}
          onChange={setCategoryId}
          // Editing keeps the category fixed: the budget row is keyed on it, so
          // changing it would silently retarget that budget's history.
          onCreate={editing ? undefined : handleCreate}
          disabled={editing}
          placeholder="Choose a category"
          searchPlaceholder="Search or type a new one…"
          emptyText="No matching category."
        />
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

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="budget-carryover">Carry over unspent</Label>
          <p className="text-xs text-muted-foreground">
            Roll last month&rsquo;s leftover (or overspend) into this month.
          </p>
        </div>
        <Switch
          id="budget-carryover"
          checked={carryover}
          onCheckedChange={setCarryover}
        />
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
