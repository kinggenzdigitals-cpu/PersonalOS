"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeftIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  Loader2Icon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { WalletIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { usePrivacyHidden } from "@/components/ui/money";
import { categoryIcon } from "@/lib/category-icons";
import { useReference } from "@/components/providers/reference-provider";
import { useProfile } from "@/components/providers/profile-provider";
import { TransactionForm } from "@/components/money/transaction-form";
import {
  fetchTransactionsAction,
  deleteTransaction,
  restoreTransaction,
} from "@/app/(app)/money/actions";
import type { Transaction, TransactionType } from "@/lib/supabase/types";
import { toast } from "sonner";

const PAGE = 50;
const TYPES: { value: string; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "adjustment", label: "Adjustment" },
];

export function TransactionsView({
  initial,
  timezone,
}: {
  initial: Transaction[];
  timezone: string;
}) {
  const router = useRouter();
  const { accounts, categories } = useReference();
  const hidden = usePrivacyHidden();
  const profile = useProfile();
  const currency = profile.currency;

  const accountName = React.useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts],
  );
  const categoryName = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const [type, setType] = React.useState<string>("all");
  const [accountId, setAccountId] = React.useState<string>("all");
  const [categoryId, setCategoryId] = React.useState<string>("all");

  const [items, setItems] = React.useState<Transaction[]>(initial);
  const [offset, setOffset] = React.useState(initial.length);
  const [hasMore, setHasMore] = React.useState(initial.length >= PAGE);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Transaction | null>(null);

  const filters = React.useMemo(
    () => ({
      type: type === "all" ? undefined : (type as TransactionType),
      accountId: accountId === "all" ? undefined : accountId,
      categoryId: categoryId === "all" ? undefined : categoryId,
    }),
    [type, accountId, categoryId],
  );

  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let active = true;
    setLoading(true);
    fetchTransactionsAction({ ...filters, limit: PAGE, offset: 0 }).then(
      (rows) => {
        if (!active) return;
        setItems(rows);
        setOffset(rows.length);
        setHasMore(rows.length >= PAGE);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [filters]);

  async function loadMore() {
    setLoading(true);
    const rows = await fetchTransactionsAction({
      ...filters,
      limit: PAGE,
      offset,
    });
    setItems((prev) => [...prev, ...rows]);
    setOffset((o) => o + rows.length);
    setHasMore(rows.length >= PAGE);
    setLoading(false);
  }

  async function refetch() {
    const rows = await fetchTransactionsAction({
      ...filters,
      limit: Math.max(offset, PAGE),
      offset: 0,
    });
    setItems(rows);
    setOffset(rows.length);
    setHasMore(rows.length >= Math.max(offset, PAGE));
  }

  function dayKey(iso: string) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  }
  function dayLabel(iso: string) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  }

  // group by day preserving order
  const groups: { key: string; label: string; rows: Transaction[]; net: number }[] =
    [];
  for (const t of items) {
    const key = dayKey(t.occurred_at);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: dayLabel(t.occurred_at), rows: [], net: 0 };
      groups.push(g);
    }
    g.rows.push(t);
    if (t.type === "income") g.net += Number(t.amount);
    else if (t.type === "expense") g.net -= Number(t.amount);
  }

  const anyFilter = type !== "all" || accountId !== "all" || categoryId !== "all";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 w-auto gap-1 text-xs" aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="h-8 w-auto gap-1 text-xs" aria-label="Account">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-8 w-auto gap-1 text-xs" aria-label="Category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} · {c.kind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setType("all");
              setAccountId("all");
              setCategoryId("all");
            }}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title={anyFilter ? "No matching transactions" : "No transactions yet"}
          description={
            anyFilter
              ? "Try clearing your filters."
              : "Add your first expense or income with the + button."
          }
          className="py-10"
        />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.key} className="space-y-1.5">
              <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span>{g.label}</span>
                {g.net !== 0 && (
                  <span
                    className={cn(
                      "tnum",
                      g.net > 0 ? "text-money-up" : "text-money-down",
                    )}
                  >
                    {hidden
                      ? "₱••••••"
                      : formatMoney(g.net, currency, { sign: true })}
                  </span>
                )}
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
                {g.rows.map((t, i) => (
                  <Row
                    key={t.id}
                    t={t}
                    currency={currency}
                    accountName={accountName}
                    categoryName={categoryName}
                    divider={i > 0}
                    onClick={() => setSelected(t)}
                  />
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              onClick={loadMore}
              disabled={loading}
            >
              {loading && (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              )}
              Load more
            </Button>
          )}
        </div>
      )}

      {/* Detail / edit sheet */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[560px]">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
            <DialogTitle className="font-display">
              {selected?.type === "income" || selected?.type === "expense"
                ? "Edit transaction"
                : "Transaction"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
          {selected && (
            <div className="space-y-4 p-4 pt-2">
              {selected.type === "income" || selected.type === "expense" ? (
                <TransactionForm
                  initial={selected}
                  allowTypeToggle={false}
                  onDone={() => {
                    setSelected(null);
                    refetch();
                  }}
                />
              ) : (
                <ReadOnlyDetail
                  t={selected}
                  currency={currency}
                  accountName={accountName}
                />
              )}
              <Button
                variant="ghost"
                className="w-full text-error hover:text-error"
                onClick={async () => {
                  const snapshot = selected;
                  setSelected(null);
                  const res = await deleteTransaction(snapshot.id);
                  if (!res.ok) return toast.error(res.error);
                  toast.success("Transaction deleted", {
                    action: {
                      label: "Undo",
                      onClick: async () => {
                        const r = await restoreTransaction(snapshot);
                        if (!r.ok) return toast.error(r.error);
                        refetch();
                        router.refresh();
                      },
                    },
                  });
                  refetch();
                  router.refresh();
                }}
              >
                <Trash2Icon className="size-4" /> Delete
              </Button>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  t,
  currency,
  accountName,
  categoryName,
  divider,
  onClick,
}: {
  t: Transaction;
  currency: string;
  accountName: Map<string, string>;
  categoryName: Map<string, string>;
  divider: boolean;
  onClick: () => void;
}) {
  const isTransfer = t.type === "transfer";
  const isAdjustment = t.type === "adjustment";
  const label = isTransfer
    ? "Transfer"
    : isAdjustment
      ? "Adjustment"
      : (t.category_id && categoryName.get(t.category_id)) ||
        t.merchant ||
        (t.type === "income" ? "Income" : "Expense");
  const iconComp = isTransfer
    ? ArrowRightLeftIcon
    : isAdjustment
      ? SlidersHorizontalIcon
      : categoryIcon(
          (t.category_id && categoryName.get(t.category_id)) || label,
        );

  const sub = isTransfer
    ? `${accountName.get(t.account_id) ?? "?"} → ${
        t.to_account_id ? accountName.get(t.to_account_id) ?? "?" : "?"
      }`
    : (accountName.get(t.account_id) ?? "");

  const hidden = usePrivacyHidden();
  const amountText = hidden
    ? "₱••••••"
    : t.type === "income"
      ? formatMoney(Number(t.amount), currency, { sign: true })
      : t.type === "expense"
        ? formatMoney(-Number(t.amount), currency, { sign: true })
        : isAdjustment
          ? formatMoney(
              (t.direction === "out" ? -1 : 1) * Number(t.amount),
              currency,
              { sign: true },
            )
          : formatMoney(Number(t.amount), currency);

  const amountClass =
    t.type === "income"
      ? "text-money-up"
      : t.type === "expense"
        ? "text-money-down"
        : "text-muted-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50",
        divider && "border-t border-border",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
        {React.createElement(iconComp, {
          className: "size-4",
          "aria-hidden": true,
        })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {sub && (
          <span className="block truncate text-xs text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
      <span className={cn("tnum shrink-0 text-sm font-semibold", amountClass)}>
        {amountText}
      </span>
    </button>
  );
}

function ReadOnlyDetail({
  t,
  currency,
  accountName,
}: {
  t: Transaction;
  currency: string;
  accountName: Map<string, string>;
}) {
  const hidden = usePrivacyHidden();
  return (
    <dl className="space-y-2 rounded-xl bg-secondary/50 p-3 text-sm">
      <Line
        label="Amount"
        value={hidden ? "₱••••••" : formatMoney(Number(t.amount), currency)}
      />
      <Line label="Type" value={t.type} />
      {t.type === "transfer" ? (
        <>
          <Line label="From" value={accountName.get(t.account_id) ?? "—"} />
          <Line
            label="To"
            value={
              t.to_account_id ? accountName.get(t.to_account_id) ?? "—" : "—"
            }
          />
        </>
      ) : (
        <Line label="Account" value={accountName.get(t.account_id) ?? "—"} />
      )}
      {t.direction && <Line label="Direction" value={t.direction} />}
      {t.notes && <Line label="Notes" value={t.notes} />}
    </dl>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground capitalize">{label}</dt>
      <dd className="tnum text-right font-medium capitalize">{value}</dd>
    </div>
  );
}
