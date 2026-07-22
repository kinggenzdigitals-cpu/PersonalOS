import type { Metadata } from "next";
import { requireOnboardedProfile } from "@/lib/auth";
import { getMoneyOverview, getCategories } from "@/lib/queries/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { MoneyQuickActions } from "@/components/money/money-quick-actions";
import { AccountCard } from "@/components/money/account-card";
import { TrendChart } from "@/components/money/trend-chart-lazy";
import { CategoryDonut } from "@/components/money/category-donut-lazy";

export const metadata: Metadata = { title: "Money" };

export default async function MoneyOverviewPage() {
  const profile = await requireOnboardedProfile();
  const [overview, categories] = await Promise.all([
    getMoneyOverview(profile.timezone),
    getCategories(),
  ]);
  const currency = profile.currency;

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
      {/* Totals */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total money</p>
              <p className="tnum font-display text-2xl">
                {formatMoney(overview.total, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Available to spend
              </p>
              <p className="tnum font-display text-2xl text-sage">
                {formatMoney(overview.available, currency)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <MoneyQuickActions />

      {/* Accounts */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Accounts</h2>
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
