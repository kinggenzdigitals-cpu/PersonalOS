"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useReference } from "@/components/providers/reference-provider";
import { useCurrency } from "@/components/providers/profile-provider";
import { MoneyAmountInput } from "@/components/money/money-amount-input";
import { categoryIcon } from "@/lib/category-icons";
import type { Transaction } from "@/lib/supabase/types";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  type TransactionInput,
} from "@/app/(app)/money/actions";
import { toast } from "sonner";
import { useUpgrade } from "@/components/providers/upgrade-provider";

const LAST_ACCOUNT_KEY = "lifeos:lastAccount";

type FormType = "expense" | "income";

function toDateInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function TransactionForm({
  initial,
  defaultType = "expense",
  allowTypeToggle = true,
  onDone,
}: {
  initial?: Transaction;
  defaultType?: FormType;
  allowTypeToggle?: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const { notify } = useUpgrade();
  const { accounts, expenseCategories, incomeCategories } = useReference();
  const currency = useCurrency();
  const editing = Boolean(initial);

  const [type, setType] = React.useState<FormType>(
    (initial?.type as FormType) ?? defaultType,
  );
  const [amount, setAmount] = React.useState(
    initial ? String(initial.amount) : "",
  );
  const [categoryId, setCategoryId] = React.useState<string | null>(
    initial?.category_id ?? null,
  );
  const [accountId, setAccountId] = React.useState<string>(() => {
    if (initial?.account_id) return initial.account_id;
    if (typeof window !== "undefined") {
      const last = window.localStorage.getItem(LAST_ACCOUNT_KEY);
      if (last && accounts.some((a) => a.id === last)) return last;
    }
    return accounts[0]?.id ?? "";
  });
  const [merchant, setMerchant] = React.useState(initial?.merchant ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [date, setDate] = React.useState(
    toDateInput(initial?.occurred_at ?? new Date().toISOString()),
  );
  const [showMore, setShowMore] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const categories = type === "expense" ? expenseCategories : incomeCategories;

  function buildOccurredAt(): string {
    const today = toDateInput(new Date().toISOString());
    if (date === today) return new Date().toISOString();
    // selected date at local noon
    return new Date(`${date}T12:00:00`).toISOString();
  }

  async function save() {
    const value = Number.parseFloat(amount);
    if (!(value > 0)) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    if (!accountId) {
      toast.error("Choose an account.");
      return;
    }
    setSaving(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
    }

    const payload: TransactionInput = {
      type,
      amount: value,
      categoryId,
      accountId,
      occurredAt: buildOccurredAt(),
      merchant: merchant || null,
      notes: notes || null,
    };

    const result = editing
      ? await updateTransaction(initial!.id, payload)
      : await createTransaction(payload);

    if (!result.ok) {
      notify(result.error);
      setSaving(false);
      return;
    }

    onDone();
    router.refresh();

    if (editing) {
      toast.success("Transaction updated");
    } else {
      const newId = result.id;
      toast.success(type === "expense" ? "Expense added" : "Income added", {
        action: newId
          ? {
              label: "Undo",
              onClick: async () => {
                await deleteTransaction(newId);
                router.refresh();
              },
            }
          : undefined,
      });
    }
  }

  return (
    <div className="space-y-4">
      {allowTypeToggle && (
        <div className="mx-auto grid w-full max-w-[220px] grid-cols-2 rounded-full bg-secondary p-1 text-sm">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setCategoryId(null);
              }}
              className={cn(
                "rounded-full py-1.5 font-medium capitalize transition-colors",
                type === t
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <MoneyAmountInput value={amount} onChange={setAmount} currency={currency} />

      {/* Category grid */}
      <div>
        <Label className="mb-2 block text-xs text-muted-foreground">
          Category
        </Label>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((c) => {
            const Icon = categoryIcon(c.name);
            const active = categoryId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(active ? null : c.id)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] transition-all",
                  active
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-card text-muted-foreground hover:border-brand/40",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="line-clamp-1 leading-tight">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Account picker */}
      <div>
        <Label className="mb-2 block text-xs text-muted-foreground">
          Account
        </Label>
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => {
            const active = accountId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccountId(a.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-card text-foreground hover:border-brand/40",
                )}
              >
                {a.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* More */}
      <button
        type="button"
        onClick={() => setShowMore((s) => !s)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronDownIcon
          className={cn("size-4 transition-transform", showMore && "rotate-180")}
        />
        More details
      </button>

      {showMore && (
        <div className="space-y-3 rounded-xl bg-secondary/50 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="merchant">Merchant / payee</Label>
            <Input
              id="merchant"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </div>
        </div>
      )}

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        {editing ? "Save changes" : "Save"}
      </Button>
    </div>
  );
}
