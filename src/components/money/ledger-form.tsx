"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/providers/profile-provider";
import { currencySymbol } from "@/lib/format";
import {
  upsertLedgerEntry,
  deleteLedgerEntry,
} from "@/app/(app)/money/ledger-actions";
import type { LedgerDirection, LedgerEntry } from "@/lib/supabase/types";
import { toast } from "sonner";

export function LedgerForm({
  initial,
  defaultDirection = "receivable",
  onDone,
}: {
  initial?: LedgerEntry;
  defaultDirection?: LedgerDirection;
  onDone: () => void;
}) {
  const router = useRouter();
  const currency = useCurrency();
  const editing = Boolean(initial);

  const [direction, setDirection] = React.useState<LedgerDirection>(
    initial?.direction ?? defaultDirection,
  );
  const [party, setParty] = React.useState(initial?.party ?? "");
  const [amount, setAmount] = React.useState(
    initial ? String(initial.amount) : "",
  );
  const [dueDate, setDueDate] = React.useState(initial?.due_date ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!party.trim()) return toast.error("Enter a name.");
    const value = Number.parseFloat(amount);
    if (!(value > 0)) return toast.error("Enter an amount.");

    setSaving(true);
    const result = await upsertLedgerEntry({
      id: initial?.id,
      direction,
      party,
      amount: value,
      dueDate: dueDate || null,
      notes: notes || null,
    });
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(editing ? "Entry updated" : "Entry added");
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    const result = await deleteLedgerEntry(initial.id);
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Entry deleted");
  }

  return (
    <div className="space-y-4">
      {!editing && (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "receivable", label: "Owed to me", hint: "Invoice / pautang" },
              { value: "payable", label: "I owe", hint: "Bill / utang" },
            ] as const
          ).map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDirection(d.value)}
              aria-pressed={direction === d.value}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                direction === d.value
                  ? d.value === "receivable"
                    ? "border-success bg-success/10"
                    : "border-error bg-error/10"
                  : "border-border hover:border-brand/40",
              )}
            >
              <span className="block text-sm font-medium">{d.label}</span>
              <span className="block text-xs text-muted-foreground">
                {d.hint}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ledger-party">
          {direction === "receivable" ? "Who owes you" : "Who you owe"}
        </Label>
        <Input
          id="ledger-party"
          value={party}
          onChange={(e) => setParty(e.target.value)}
          placeholder="Customer, supplier, or person"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ledger-amount">Amount</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              {currencySymbol(currency)}
            </span>
            <Input
              id="ledger-amount"
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
          <Label htmlFor="ledger-due">Due date</Label>
          <Input
            id="ledger-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ledger-notes">Notes</Label>
        <Textarea
          id="ledger-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional (invoice #, reason, terms)"
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
          {editing ? "Save changes" : "Add entry"}
        </Button>
      </div>
    </div>
  );
}
