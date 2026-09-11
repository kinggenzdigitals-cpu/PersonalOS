"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { TrendingUpIcon } from "lucide-react";
import { useCurrency } from "@/components/providers/profile-provider";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import type { CashFlowForecast } from "@/lib/queries/planning";

/**
 * Rest-of-month cash-flow estimate: spendable balance → known bills still due
 * → projected end-of-month balance. Every figure comes from real ledger data;
 * the projection is clearly labelled as an estimate.
 */
export function CashFlowCard({ forecast }: { forecast: CashFlowForecast }) {
  const currency = useCurrency();
  const {
    spendable,
    upcomingBills,
    upcomingBillsTotal,
    upcomingIncomeTotal,
    paceProjectedSpend,
    projectedRemainingSpend,
    projectedEndBalance,
    daysLeft,
  } = forecast;
  const negative = projectedEndBalance < -0.5;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground">
          <TrendingUpIcon className="size-4" aria-hidden />
        </span>
        <div>
          <p className="font-medium leading-tight">Cash-flow forecast</p>
          <p className="text-xs text-muted-foreground">
            Next {daysLeft} day{daysLeft === 1 ? "" : "s"} · estimate
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Spendable now">
          <Money value={spendable} currency={currency} />
        </Row>
        {upcomingIncomeTotal > 0 && (
          <Row label="Income still due this month" muted>
            +<Money value={upcomingIncomeTotal} currency={currency} />
          </Row>
        )}
        <Row label="Bills still due this month" muted>
          −<Money value={upcomingBillsTotal} currency={currency} />
        </Row>
        {paceProjectedSpend > upcomingBillsTotal + 0.5 && (
          <Row label="Extra spend at current pace" muted>
            −
            <Money
              value={projectedRemainingSpend - upcomingBillsTotal}
              currency={currency}
            />
          </Row>
        )}
        <div className="my-1 border-t border-border" />
        <Row label="Projected end of month" strong>
          <span className={cn(negative ? "text-error" : "text-success")}>
            <Money value={projectedEndBalance} currency={currency} />
          </span>
        </Row>
      </dl>

      {upcomingBills.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
          {upcomingBills.slice(0, 6).map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="min-w-0 truncate">
                <span
                  className={cn(
                    "tnum mr-2 inline-block w-14 text-muted-foreground",
                    b.daysUntil < 0 && "text-error",
                  )}
                >
                  {format(new Date(`${b.dueDate}T00:00:00`), "MMM d")}
                </span>
                {b.name}
                {b.daysUntil < 0 && (
                  <span className="ml-1 text-error">· overdue</span>
                )}
              </span>
              <span className="tnum shrink-0 text-muted-foreground">
                {b.kind === "income" ? "+" : "-"}
                <Money value={b.amount} currency={currency} />
              </span>
            </li>
          ))}
          {upcomingBills.length > 6 && (
            <li className="text-[11px] text-muted-foreground">
              +{upcomingBills.length - 6} more
            </li>
          )}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        {negative
          ? "Projected to run short — consider trimming discretionary spend or moving funds."
          : "Includes recurring income and bills due this month."}
      </p>
    </div>
  );
}

function Row({
  label,
  muted,
  strong,
  children,
}: {
  label: string;
  muted?: boolean;
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className={cn("text-muted-foreground", strong && "font-medium text-foreground")}>
        {label}
      </dt>
      <dd
        className={cn(
          "tnum",
          muted && "text-muted-foreground",
          strong && "font-semibold",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
