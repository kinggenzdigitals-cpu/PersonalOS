"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2Icon,
  ChevronDownIcon,
  SparklesIcon,
  CopyCheckIcon,
  StarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useReference } from "@/components/providers/reference-provider";
import { useCurrency } from "@/components/providers/profile-provider";
import { MoneyAmountInput } from "@/components/money/money-amount-input";
import { Money } from "@/components/ui/money";
import { categoryIcon } from "@/lib/category-icons";
import {
  parseQuickEntry,
  suggestCategoryName,
  resolveCategory,
} from "@/lib/transaction-parser";
import type { Transaction } from "@/lib/supabase/types";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  findPossibleDuplicates,
  type TransactionInput,
  type DuplicateMatch,
} from "@/app/(app)/money/actions";
import {
  getLearnedCategory,
  learnCategory,
  saveFavorite,
} from "@/app/(app)/money/entry-actions";
import { toast } from "sonner";
import { useUpgrade } from "@/components/providers/upgrade-provider";

const LAST_ACCOUNT_KEY = "lifeos:lastAccount";

type FormType = "expense" | "income";

function toDateInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** Values a favourite (or any caller) can pre-populate the form with. */
export type TransactionPrefill = {
  type?: FormType;
  amount?: number | null;
  categoryId?: string | null;
  accountId?: string | null;
  merchant?: string | null;
};

export function TransactionForm({
  initial,
  defaultType = "expense",
  allowTypeToggle = true,
  prefill,
  onDone,
}: {
  initial?: Transaction;
  defaultType?: FormType;
  allowTypeToggle?: boolean;
  prefill?: TransactionPrefill;
  onDone: () => void;
}) {
  const router = useRouter();
  const { notify } = useUpgrade();
  const { accounts, expenseCategories, incomeCategories } = useReference();
  const currency = useCurrency();
  const editing = Boolean(initial);

  const [type, setType] = React.useState<FormType>(
    (initial?.type as FormType) ?? prefill?.type ?? defaultType,
  );
  const [amount, setAmount] = React.useState(
    initial
      ? String(initial.amount)
      : prefill?.amount != null
        ? String(prefill.amount)
        : "",
  );
  const [categoryId, setCategoryId] = React.useState<string | null>(
    initial?.category_id ?? prefill?.categoryId ?? null,
  );
  const [accountId, setAccountId] = React.useState<string>(() => {
    if (initial?.account_id) return initial.account_id;
    if (prefill?.accountId && accounts.some((a) => a.id === prefill.accountId)) {
      return prefill.accountId;
    }
    if (typeof window !== "undefined") {
      const last = window.localStorage.getItem(LAST_ACCOUNT_KEY);
      if (last && accounts.some((a) => a.id === last)) return last;
    }
    return accounts[0]?.id ?? "";
  });
  const [merchant, setMerchant] = React.useState(
    initial?.merchant ?? prefill?.merchant ?? "",
  );
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [date, setDate] = React.useState(
    toDateInput(initial?.occurred_at ?? new Date().toISOString()),
  );
  const [showMore, setShowMore] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Quick entry: one line like "soft drinks 120" → amount + merchant + category.
  const [quick, setQuick] = React.useState("");
  const [suggested, setSuggested] = React.useState<string | null>(null);
  const categoryTouched = React.useRef(false);
  const lookupId = React.useRef(0);

  // Possible duplicates surfaced before saving (never auto-deleted).
  const [duplicates, setDuplicates] = React.useState<DuplicateMatch[] | null>(
    null,
  );

  const categories = type === "expense" ? expenseCategories : incomeCategories;

  /**
   * Parse the quick-entry line and prefill the form. The keyword guess applies
   * immediately; a per-user learned mapping (if any) overrides it a moment
   * later. A category the user picked by hand is never overwritten.
   */
  function handleQuickEntry(raw: string) {
    setQuick(raw);
    const parsed = parseQuickEntry(raw);

    if (parsed.amount !== null) setAmount(String(parsed.amount));
    setMerchant(parsed.merchant);

    const nextType = allowTypeToggle ? parsed.type : type;
    if (nextType !== type) setType(nextType);

    const pool = nextType === "expense" ? expenseCategories : incomeCategories;
    const text = parsed.merchant || raw;

    if (!categoryTouched.current) {
      const guess = resolveCategory(suggestCategoryName(text), pool);
      setCategoryId(guess?.id ?? null);
      setSuggested(guess ? guess.name : null);
    }

    // Learned mapping wins over the keyword guess — look it up debounced.
    const id = ++lookupId.current;
    const merchantText = parsed.merchant.trim();
    if (!merchantText) return;
    window.setTimeout(async () => {
      if (id !== lookupId.current || categoryTouched.current) return;
      const learned = await getLearnedCategory(merchantText);
      if (id !== lookupId.current || categoryTouched.current || !learned) return;
      const match = pool.find((c) => c.id === learned);
      if (!match) return;
      setCategoryId(match.id);
      setSuggested(match.name);
    }, 350);
  }

  function pickCategory(id: string | null) {
    categoryTouched.current = true;
    setSuggested(null);
    setCategoryId(id);
  }

  /** Save the current entry as a reusable favourite. */
  async function addFavorite() {
    const value = Number.parseFloat(amount);
    const label =
      merchant.trim() ||
      categories.find((c) => c.id === categoryId)?.name ||
      "";
    if (!label) {
      toast.error("Add a merchant or category to name this favourite.");
      return;
    }
    const result = await saveFavorite({
      label,
      type,
      amount: value > 0 ? value : null,
      categoryId,
      accountId: accountId || null,
      merchant: merchant.trim() || null,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Saved "${label}" to favourites`);
  }

  function buildOccurredAt(): string {
    const today = toDateInput(new Date().toISOString());
    if (date === today) return new Date().toISOString();
    // selected date at local noon
    return new Date(`${date}T12:00:00`).toISOString();
  }

  async function save(force = false) {
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

    const payload: TransactionInput = {
      type,
      amount: value,
      categoryId,
      accountId,
      occurredAt: buildOccurredAt(),
      merchant: merchant || null,
      notes: notes || null,
    };

    // Warn about a possible duplicate once, before the first save attempt.
    // Nothing is ever deleted — the user chooses to continue or cancel.
    if (!force) {
      const found = await findPossibleDuplicates({
        type,
        amount: value,
        accountId,
        occurredAt: payload.occurredAt,
        merchant: payload.merchant,
        excludeId: initial?.id,
      });
      if (found.length > 0) {
        setDuplicates(found);
        setSaving(false);
        return;
      }
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
    }

    const result = editing
      ? await updateTransaction(initial!.id, payload)
      : await createTransaction(payload);

    if (!result.ok) {
      notify(result.error);
      setSaving(false);
      return;
    }

    // Remember this user's merchant → category choice for next time.
    await learnCategory(payload.merchant, categoryId);

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
                setSuggested(null);
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

      {!editing && (
        <div className="space-y-1.5">
          <Label htmlFor="quick-entry" className="text-xs text-muted-foreground">
            Quick entry
          </Label>
          <Input
            id="quick-entry"
            value={quick}
            onChange={(e) => handleQuickEntry(e.target.value)}
            placeholder="e.g. soft drinks 120"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Type what you spent — we&rsquo;ll fill in the amount, merchant and
            category. Everything below stays editable.
          </p>
        </div>
      )}

      <MoneyAmountInput value={amount} onChange={setAmount} currency={currency} />

      {/* Category grid */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label className="block text-xs text-muted-foreground">Category</Label>
          {suggested && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              <SparklesIcon className="size-3" aria-hidden />
              Suggested: {suggested}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((c) => {
            const Icon = categoryIcon(c.name);
            const active = categoryId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCategory(active ? null : c.id)}
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

      {duplicates && duplicates.length > 0 && (
        <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CopyCheckIcon className="size-4 text-warning" aria-hidden />
            Possible duplicate transaction found
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {duplicates.map((d) => (
              <li key={d.id} className="tnum">
                <Money value={Number(d.amount)} currency={currency} />
                {d.merchant ? ` · ${d.merchant}` : ""} ·{" "}
                {new Date(d.occurred_at).toLocaleDateString()}
                {d.import_fingerprint ? " · imported" : ""}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Nothing has been saved or removed. Continue if this is a separate
            transaction.
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDuplicates(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setDuplicates(null);
                void save(true);
              }}
              disabled={saving}
            >
              Save anyway
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!editing && (
          <Button
            type="button"
            variant="outline"
            onClick={addFavorite}
            disabled={saving}
            title="Save as a favourite for one-tap re-entry"
          >
            <StarIcon className="size-4" aria-hidden />
            <span className="sr-only">Save as favourite</span>
          </Button>
        )}
        <Button
          className="flex-1"
          onClick={() => save()}
          disabled={saving || Boolean(duplicates)}
        >
          {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
          {editing ? "Save changes" : "Save"}
        </Button>
      </div>
    </div>
  );
}
