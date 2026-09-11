import Link from "next/link";
import { createElement } from "react";
import { format } from "date-fns";
import {
  WalletIcon,
  ReceiptTextIcon,
  ArrowRightIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
} from "lucide-react";
import { Money } from "@/components/ui/money";
import { categoryIcon } from "@/lib/category-icons";
import { clampPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BudgetSummary, UpcomingBill } from "@/lib/queries/planning";
import type {
  AccountBalance,
  Category,
  Transaction,
} from "@/lib/supabase/types";

/**
 * Compact dashboard versions of the money cards. Server components that render
 * the privacy-aware <Money> client component, so no extra client JS ships for
 * what is essentially read-only content.
 */

function CardShell({
  href,
  title,
  icon,
  children,
  aside,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium leading-tight">
          <span className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground">
            {icon}
          </span>
          {title}
        </p>
        {aside ?? (
          <Link
            href={href}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View <ArrowRightIcon className="inline size-3" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

/** Monthly budget: total, spent, remaining, unallocated. */
export function BudgetSummaryCard({
  summary,
  currency,
}: {
  summary: BudgetSummary;
  currency: string;
}) {
  const { hasMonthlyBudget, total, spent, remaining, unallocated, overallPct } =
    summary;

  const bar =
    overallPct > 100 ? "bg-error" : overallPct >= 80 ? "bg-warning" : "bg-success";

  return (
    <CardShell
      href="/money/budgets"
      title="Monthly budget"
      icon={<WalletIcon className="size-4" aria-hidden />}
    >
      {!hasMonthlyBudget ? (
        <Link
          href="/money/budgets"
          className="mt-3 block rounded-lg border border-dashed border-border bg-secondary/40 p-3 text-center text-sm text-muted-foreground transition-colors hover:border-brand/40"
        >
          Set a monthly budget to see what&rsquo;s allocated and left →
        </Link>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between gap-2">
            <p className="fht-amount text-2xl font-semibold">
              <Money value={total} currency={currency} />
            </p>
            <p className="tnum text-right text-xs text-muted-foreground">
              <Money value={spent} currency={currency} /> spent
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full", bar)}
              style={{ width: `${clampPercent(overallPct)}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-secondary/40 px-3 py-2">
              <p className="uppercase tracking-wide text-muted-foreground">
                Remaining
              </p>
              <p className="fht-amount mt-0.5 font-medium">
                <Money value={remaining} currency={currency} />
              </p>
            </div>
            <div className="rounded-lg bg-secondary/40 px-3 py-2">
              <p className="uppercase tracking-wide text-muted-foreground">
                Unallocated
              </p>
              <p
                className={cn(
                  "fht-amount mt-0.5 font-medium",
                  unallocated < -0.5
                    ? "text-error"
                    : unallocated > 0.5
                      ? "text-success"
                      : undefined,
                )}
              >
                <Money value={unallocated} currency={currency} />
              </p>
            </div>
          </div>
        </>
      )}
    </CardShell>
  );
}

/** Cash available, per account. Balances are manual/imported — never "live". */
export function CashAvailableCard({
  accounts,
  currency,
  lowThreshold,
}: {
  accounts: AccountBalance[];
  currency: string;
  lowThreshold: number;
}) {
  const spending = accounts.filter((a) => a.is_spending);
  const totalAvailable = spending.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <CardShell
      href="/money"
      title="Cash available"
      icon={<WalletIcon className="size-4" aria-hidden />}
    >
      <p className="fht-amount mt-3 text-2xl font-semibold">
        <Money value={totalAvailable} currency={currency} />
      </p>
      {accounts.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No accounts yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {accounts.slice(0, 6).map((a) => {
            const balance = Number(a.balance);
            const low = a.is_spending && balance < lowThreshold;
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate text-muted-foreground">
                  {a.name}
                  {!a.is_spending && (
                    <span className="ml-1.5 text-[11px]">· savings</span>
                  )}
                </span>
                <span
                  className={cn(
                    "tnum shrink-0",
                    balance < 0 ? "text-error" : low ? "text-warning" : undefined,
                  )}
                >
                  <Money value={balance} currency={currency} />
                </span>
              </li>
            );
          })}
          {accounts.length > 6 && (
            <li className="text-[11px] text-muted-foreground">
              +{accounts.length - 6} more
            </li>
          )}
        </ul>
      )}
    </CardShell>
  );
}

/** Recurring income and bills still due this month. */
export function UpcomingBillsCard({
  bills,
  currency,
}: {
  bills: UpcomingBill[];
  currency: string;
}) {
  const incomeTotal = bills
    .filter((b) => b.kind === "income")
    .reduce((s, b) => s + b.amount, 0);
  const expenseTotal = bills
    .filter((b) => b.kind === "expense")
    .reduce((s, b) => s + b.amount, 0);

  return (
    <CardShell
      href="/money/bills"
      title="Upcoming recurring"
      icon={<ReceiptTextIcon className="size-4" aria-hidden />}
    >
      {bills.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing else due this month.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Income
              </p>
              <p className="fht-amount font-semibold text-success">
                +<Money value={incomeTotal} currency={currency} />
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Bills
              </p>
              <p className="fht-amount font-semibold">
                <Money value={expenseTotal} currency={currency} />
              </p>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {bills.slice(0, 5).map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span
                    className={cn(
                      "tnum mr-2 inline-block w-12 text-xs text-muted-foreground",
                      b.daysUntil < 0 && "text-error",
                    )}
                  >
                    {format(new Date(`${b.dueDate}T00:00:00`), "MMM d")}
                  </span>
                  <span className="text-muted-foreground">{b.name}</span>
                </span>
                <span className="tnum shrink-0 text-muted-foreground">
                  {b.kind === "income" ? "+" : "-"}
                  <Money value={b.amount} currency={currency} />
                </span>
              </li>
            ))}
            {bills.length > 5 && (
              <li className="text-[11px] text-muted-foreground">
                +{bills.length - 5} more
              </li>
            )}
          </ul>
        </>
      )}
    </CardShell>
  );
}

/** The latest few transactions. */
export function RecentTransactionsCard({
  transactions,
  categories,
  currency,
}: {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
}) {
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <CardShell
      href="/money/transactions"
      title="Recent transactions"
      icon={<ReceiptTextIcon className="size-4" aria-hidden />}
    >
      {transactions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing recorded yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {transactions.map((t) => {
            const income = t.type === "income";
            const label =
              t.merchant ||
              (t.category_id ? (catName.get(t.category_id) ?? "") : "") ||
              t.type;
            const category = t.category_id ? catName.get(t.category_id) : null;
            const Icon = categoryIcon(category ?? "");
            return (
              <li key={t.id} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full",
                    income
                      ? "bg-success/10 text-success"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {income ? (
                    <ArrowDownLeftIcon className="size-4" aria-hidden />
                  ) : t.type === "expense" ? (
                    createElement(Icon, { className: "size-4", "aria-hidden": true })
                  ) : (
                    <ArrowUpRightIcon className="size-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {format(new Date(t.occurred_at), "MMM d")}
                    {category ? ` · ${category}` : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "tnum shrink-0 text-sm",
                    income ? "text-success" : undefined,
                  )}
                >
                  {income ? "+" : ""}
                  <Money value={Number(t.amount)} currency={currency} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </CardShell>
  );
}
