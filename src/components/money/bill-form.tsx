"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { upsertBill, deleteBill } from "@/app/(app)/money/planning-actions";
import type { Bill, BillFrequency } from "@/lib/supabase/types";
import { toast } from "sonner";

const FREQUENCIES: { value: BillFrequency; label: string }[] = [
  { value: "once", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const NONE = "__none__";

export function BillForm({
  initial,
  onDone,
}: {
  initial?: Bill;
  onDone: () => void;
}) {
  const router = useRouter();
  const { accounts, expenseCategories } = useReference();
  const currency = useCurrency();
  const editing = Boolean(initial);

  const [name, setName] = React.useState(initial?.name ?? "");
  const [amount, setAmount] = React.useState(
    initial ? String(initial.amount) : "",
  );
  const [categoryId, setCategoryId] = React.useState(
    initial?.category_id ?? NONE,
  );
  const [accountId, setAccountId] = React.useState(
    initial?.account_id ?? NONE,
  );
  const [frequency, setFrequency] = React.useState<BillFrequency>(
    initial?.frequency ?? "monthly",
  );
  const [nextDueDate, setNextDueDate] = React.useState(
    initial?.next_due_date ?? "",
  );
  const [remindDays, setRemindDays] = React.useState(
    String(initial?.remind_days_before ?? 3),
  );
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Name the bill.");
    const value = Number.parseFloat(amount);
    if (!(value > 0)) return toast.error("Enter an amount.");
    if (!nextDueDate) return toast.error("Pick a due date.");

    setSaving(true);
    const result = await upsertBill({
      id: initial?.id,
      name,
      amount: value,
      categoryId: categoryId === NONE ? null : categoryId,
      accountId: accountId === NONE ? null : accountId,
      frequency,
      nextDueDate,
      remindDaysBefore: Number.parseInt(remindDays, 10) || 0,
      notes: notes || null,
    });
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(editing ? "Bill updated" : "Bill added");
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    const result = await deleteBill(initial.id);
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Bill removed");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="bill-name">Name</Label>
        <Input
          id="bill-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Meralco"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bill-amount">Amount</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              {currencySymbol(currency)}
            </span>
            <Input
              id="bill-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="0.00"
              className="pl-7 tnum"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill-due">Next due</Label>
          <Input
            id="bill-due"
            type="date"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Frequency</Label>
          <Select
            value={frequency}
            onValueChange={(v) => setFrequency(v as BillFrequency)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill-remind">Remind days before</Label>
          <Input
            id="bill-remind"
            inputMode="numeric"
            value={remindDays}
            onChange={(e) =>
              setRemindDays(e.target.value.replace(/[^0-9]/g, ""))
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Optional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No category</SelectItem>
            {expenseCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Default payment account</Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Optional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Ask each time</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bill-notes">Notes</Label>
        <Textarea
          id="bill-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
          rows={2}
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
          {editing ? "Save changes" : "Add bill"}
        </Button>
      </div>
    </div>
  );
}
