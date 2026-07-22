import Link from "next/link";
import type { Metadata } from "next";
import { requireOnboardedProfile } from "@/lib/auth";
import { getMoneyOverview, getCategories } from "@/lib/queries/money";
import { getLedgerSummary } from "@/lib/queries/ledger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MoneyQuickActions } from "@/components/money/money-quick-actions";
import { NetPositionCard } from "@/components/money/net-position";
import { AccountCard } from "@/components/money/account-card";
import { TrendChart } from "@/components/money/trend-chart-lazy";
import { CategoryDonut } from "@/components/money/category-donut-lazy";

export const metadata: Metadata = { title: "Money" };

export default async function MoneyOverviewPage() {
  const profile = await requireOnboardedProfile();
  const [overview, categories, ledger] = await Promise.all([
    getMoneyOverview(profile.timezone),
    getCategories(),
    getLedgerSummary(profile.timezone),
  ]);
  const currency = profile.currency;
  const hasLedger =
    ledger.totalReceivable > 0 || ledger.totalPayable > 0;

  const catName = new Map(categories.map((c) => [c.id, c]));
  const donutData = overview.byCategory.map((row) => {
    const c = row.categoryId ? catName.get(row.categoryId) : undefined;
    return {
      name: c?.name ?? "Uncategorized",
      amount: row.amount,
      color: c?.color ?? null,
    };
  });

  const net = overview.monthIncome - overview.monthExpense;

  return (
    <div className="space-y-5">
      {/* Net position */}
      <NetPositionCard
        cash={overview.total}
        receivable={ledger.totalReceivable}
        payable={ledger.totalPayable}
        available={overview.available}
        currency={currency}
      />

      <MoneyQuickActions />

      {/* Cash Position */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Cash Position
        </h2>
        {overview.accounts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {overview.accounts.map((a) => (
              <AccountCard key={a.id} balance={a} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No accounts yet. Add one above.
          </p>
        )}
      </section>

      {/* Receivables & Payables */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Receivables &amp; Payables
          </h2>
          <Link
            href="/money/owed"
            className="text-xs text-brand underline-offset-4 hover:underline"
          >
            {hasLedger ? "Manage →" : "Add →"}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <LedgerStat
            label="Total Receivable"
            value={formatMoney(ledger.totalReceivable, currency)}
            sub={
              ledger.overdueReceivable > 0
                ? `${formatMoney(ledger.overdueReceivable, currency)} overdue`
                : "Owed to you"
            }
            overdue={ledger.overdueReceivable > 0}
            tone="up"
          />
          <LedgerStat
            label="Total Payable"
            value={formatMoney(ledger.totalPayable, currency)}
            sub={
              ledger.overduePayable > 0
                ? `${formatMoney(ledger.overduePayable, currency)} overdue`
                : "You owe"
            }
            overdue={ledger.overduePayable > 0}
            tone="down"
          />
        </div>
      </section>

      {/* This month */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">This month</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat
              label="Income"
              value={formatMoney(overview.monthIncome, currency)}
              className="text-money-up"
            />
            <Stat
              label="Expenses"
              value={formatMoney(overview.monthExpense, currency)}
              className="text-money-down"
            />
            <Stat
              label="Net"
              value={formatMoney(net, currency, { sign: true })}
              className={net >= 0 ? "text-money-up" : "text-money-down"}
            />
          </div>
          <TrendChart data={overview.trend} currency={currency} />
        </CardContent>
      </Card>

      {/* Spending by category */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Spending by category</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryDonut data={donutData} currency={currency} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/60 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tnum mt-0.5 text-sm font-semibold ${className ?? ""}`}>
        {value}
      </p>
    </div>
  );
}

function LedgerStat({
  label,
  value,
  sub,
  overdue,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  overdue: boolean;
  tone: "up" | "down";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tnum mt-1 font-display text-xl",
          tone === "up" ? "text-money-up" : "text-money-down",
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-0.5 text-[11px]",
          overdue ? "text-error" : "text-muted-foreground",
        )}
      >
        {sub}
      </p>
    </div>
  );
}
