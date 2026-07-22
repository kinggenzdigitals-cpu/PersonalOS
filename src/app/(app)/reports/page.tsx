import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getReport, type ReportPeriod } from "@/lib/queries/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { LIFE_AREA_MAP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { LifeArea } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; offset?: string }>;
}) {
  const profile = await requireOnboardedProfile();
  const sp = await searchParams;
  const period: ReportPeriod = sp.period === "week" ? "week" : "month";
  const offset = Math.min(0, Number.parseInt(sp.offset ?? "0", 10) || 0);
  const weekStartsOn: 0 | 1 = profile.week_starts_on === "sunday" ? 0 : 1;

  const report = await getReport(
    profile.timezone,
    period,
    offset,
    weekStartsOn,
  );
  const currency = profile.currency;

  const href = (p: ReportPeriod, o: number) =>
    `/reports?period=${p}&offset=${o}`;
  const maxCat = Math.max(1, ...report.money.byCategory.map((c) => c.amount));

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="font-display text-2xl tracking-tight">Reports</h1>
        <div className="flex items-center justify-between">
          <div className="inline-flex gap-1 rounded-full bg-secondary p-1 text-sm">
            {(["week", "month"] as const).map((p) => (
              <Link
                key={p}
                href={href(p, 0)}
                className={cn(
                  "rounded-full px-4 py-1.5 font-medium capitalize transition-colors",
                  period === p
                    ? "bg-card text-foreground shadow-soft"
                    : "text-muted-foreground",
                )}
              >
                {p}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={href(period, offset - 1)}
              aria-label="Previous period"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeftIcon className="size-5" />
            </Link>
            {offset < 0 ? (
              <Link
                href={href(period, offset + 1)}
                aria-label="Next period"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ChevronRightIcon className="size-5" />
              </Link>
            ) : (
              <span className="rounded-lg p-1.5 text-muted-foreground/40">
                <ChevronRightIcon className="size-5" />
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{report.label}</p>
      </header>

      {/* Auto summary */}
      <Card className="border-brand/30 bg-brand/5 shadow-soft">
        <CardContent className="pt-6">
          <p className="text-sm leading-relaxed">{report.summary}</p>
        </CardContent>
      </Card>

      {/* Money */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Money</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Income" value={formatMoney(report.money.income, currency)} className="text-money-up" />
            <Stat label="Expenses" value={formatMoney(report.money.expense, currency)} className="text-money-down" />
            <Stat
              label="Net"
              value={formatMoney(report.money.net, currency, { sign: true })}
              className={report.money.net >= 0 ? "text-money-up" : "text-money-down"}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Into savings</span>
            <span className="tnum font-medium text-sage">
              {formatMoney(report.money.savingsInflow, currency)}
            </span>
          </div>

          {report.money.byCategory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Spending by category
              </p>
              {report.money.byCategory.slice(0, 6).map((c) => (
                <div key={c.name} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span>{c.name}</span>
                    <span className="tnum text-muted-foreground">
                      {formatMoney(c.amount, currency)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(c.amount / maxCat) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {report.money.topMerchants.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Top merchants
              </p>
              <ul className="space-y-1 text-sm">
                {report.money.topMerchants.map((m) => (
                  <li key={m.name} className="flex justify-between">
                    <span className="truncate">{m.name}</span>
                    <span className="tnum text-muted-foreground">
                      {formatMoney(m.amount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-success">
              {report.money.budgets.met} within budget
            </span>
            <span className="rounded-full bg-error/10 px-2 py-0.5 text-error">
              {report.money.budgets.exceeded} exceeded
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Habits */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Habits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="tnum font-display text-3xl">
              {report.habits.completionPct}%
            </p>
            <p className="text-xs text-muted-foreground">completion</p>
          </div>
          {report.habits.byArea.length > 0 && (
            <div className="space-y-1.5">
              {report.habits.byArea.map((a) => {
                const area = LIFE_AREA_MAP[a.area as LifeArea];
                return (
                  <div key={a.area} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span>{area?.label ?? a.area}</span>
                      <span className="tnum text-muted-foreground">{a.pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${a.pct}%`,
                          backgroundColor: area?.color ?? "var(--sage)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {report.habits.mostMissed.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="text-xs font-medium text-muted-foreground">
                Most missed
              </p>
              {report.habits.mostMissed.map((m) => (
                <div key={m.name} className="flex justify-between">
                  <span>{m.name}</span>
                  <span className="tnum text-error">{m.missedPct}% missed</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mood */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Mood</CardTitle>
        </CardHeader>
        <CardContent>
          {report.mood.entries === 0 ? (
            <p className="text-sm text-muted-foreground">
              No check-ins this {period}.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat
                label="Avg mood"
                value={report.mood.avgMood?.toFixed(1) ?? "–"}
              />
              <Stat
                label="Avg energy"
                value={report.mood.avgEnergy?.toFixed(1) ?? "–"}
              />
              <Stat
                label="Avg stress"
                value={report.mood.avgStress?.toFixed(1) ?? "–"}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Completed" value={`${report.tasks.completed}`} />
            <Stat
              label="Top-3 hit rate"
              value={
                report.tasks.topThreeHitRate != null
                  ? `${report.tasks.topThreeHitRate}%`
                  : "–"
              }
            />
            <Stat label="Carried over" value={`${report.tasks.carriedOver}`} />
          </div>
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
      <p className={cn("tnum mt-0.5 text-sm font-semibold", className)}>
        {value}
      </p>
    </div>
  );
}
