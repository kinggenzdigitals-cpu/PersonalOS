"use client";

import * as React from "react";
import Link from "next/link";
import { CheckIcon, SparklesIcon, CreditCardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { cn } from "@/lib/utils";
import {
  PLANS,
  PLAN_PRICES,
  BILLING_PERIODS,
  planPrice,
  type PlanId,
  type BillingPeriod,
  type PlanLimits,
} from "@/lib/plans";
import type { Usage } from "@/lib/queries/usage";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

const CLICKABLE: PlanId[] = ["free", "pro", "premium"];

const METRICS: { label: string; used: keyof Usage; limit: keyof PlanLimits }[] =
  [
    { label: "Transactions", used: "transactions", limit: "transactionsPerMonth" },
    { label: "Wallets", used: "accounts", limit: "accounts" },
    { label: "Habits", used: "habits", limit: "habits" },
    { label: "Savings goals", used: "goals", limit: "goals" },
    { label: "Budgets", used: "budgets", limit: "budgets" },
  ];

export function PlanCards({
  currentPlan,
  usage,
  complimentary,
}: {
  currentPlan: PlanId;
  usage: Usage;
  complimentary: boolean;
}) {
  const [open, setOpen] = React.useState<PlanId | null>(null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {CLICKABLE.map((id) => {
          const p = PLANS[id];
          const annual = id === "free" ? null : PLAN_PRICES[id].annual;
          const current = currentPlan === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setOpen(id)}
              aria-label={`View ${p.name} plan details`}
              className={cn(
                "group relative flex flex-col rounded-2xl border bg-card p-5 text-left transition-all",
                "hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                current
                  ? "border-2 border-brand shadow-card"
                  : "border-border shadow-soft hover:border-brand/50",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-lg">{p.name}</p>
                {p.label && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                    {p.label}
                  </span>
                )}
              </div>
              {annual ? (
                <>
                  <p className="tnum mt-1 font-display text-2xl">
                    {peso(annual.monthlyEq)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      /mo
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {peso(annual.total)} / year · save {peso(annual.save)}
                  </p>
                </>
              ) : (
                <p className="tnum mt-1 font-display text-2xl">Free</p>
              )}
              <p
                className={cn(
                  "mt-2 text-xs font-medium",
                  current ? "text-brand" : "text-brand-2 opacity-0 transition-opacity group-hover:opacity-100",
                )}
              >
                {current ? "Your current plan" : "View plan details →"}
              </p>
            </button>
          );
        })}
      </div>

      <FormSheet
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? `${PLANS[open].name} plan` : ""}
        size="xl"
      >
        {(close) =>
          open ? (
            <PlanDetails
              plan={open}
              currentPlan={currentPlan}
              usage={usage}
              complimentary={complimentary}
              onClose={close}
            />
          ) : null
        }
      </FormSheet>
    </>
  );
}

function PlanDetails({
  plan,
  currentPlan,
  usage,
  complimentary,
  onClose,
}: {
  plan: PlanId;
  currentPlan: PlanId;
  usage: Usage;
  complimentary: boolean;
  onClose: () => void;
}) {
  const [period, setPeriod] = React.useState<BillingPeriod>("annual");
  const p = PLANS[plan];
  const price = planPrice(plan, period);
  const isCurrent = plan === currentPlan;

  return (
    <div className="space-y-5">
      <div>
        {p.label && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
            {p.label}
          </span>
        )}
        <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
      </div>

      {/* Billing period + price */}
      {price && (
        <div className="space-y-3">
          <div className="inline-flex flex-wrap gap-1 rounded-xl bg-secondary p-1 text-xs">
            {BILLING_PERIODS.map((bp) => (
              <button
                key={bp.id}
                type="button"
                onClick={() => setPeriod(bp.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 font-medium transition-colors",
                  period === bp.id
                    ? "bg-card text-foreground shadow-soft"
                    : "text-muted-foreground",
                )}
              >
                {bp.label}
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-secondary/50 p-4">
            <p className="tnum font-display text-2xl">
              {peso(price.total)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {BILLING_PERIODS.find((b) => b.id === period)?.label.toLowerCase()}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Equivalent to {peso(price.monthlyEq)}/month
              {price.save > 0 && ` · save ${peso(price.save)} vs monthly`}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Renews at {peso(price.total)} unless cancelled.
            </p>
          </div>
        </div>
      )}

      {/* Current vs new limits */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Your usage vs {p.name}
        </p>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Feature</th>
                <th className="px-3 py-2 text-right font-medium">Current</th>
                <th className="px-3 py-2 text-right font-medium">{p.name}</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => {
                const curLimit = PLANS[currentPlan].limits[m.limit];
                const newLimit = PLANS[plan].limits[m.limit];
                return (
                  <tr key={m.label} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{m.label}</td>
                    <td className="tnum px-3 py-2 text-right text-muted-foreground">
                      {usage[m.used]}
                      {typeof curLimit === "number" ? ` of ${curLimit}` : ""}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-medium">
                      {typeof newLimit === "number" ? newLimit : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-2 text-sm">
        {p.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
              <CheckIcon className="size-3.5" />
            </span>
            {f}
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={onClose}>
          Maybe later
        </Button>
        <Button variant="outline" asChild>
          <Link href="/pricing">Compare all plans</Link>
        </Button>
        {isCurrent || complimentary ? (
          <Button asChild className="ml-auto">
            <Link href="/settings">
              <CreditCardIcon className="size-4" />
              {isCurrent ? "Manage subscription" : "Manage"}
            </Link>
          </Button>
        ) : (
          plan !== "free" && (
            <Button asChild className="ml-auto">
              <Link href="/settings">
                <SparklesIcon className="size-4" /> Upgrade to {p.name}
              </Link>
            </Button>
          )
        )}
      </div>
    </div>
  );
}
