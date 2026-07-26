"use client";

import * as React from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLANS,
  PLAN_ORDER,
  BILLING_PERIODS,
  planPrice,
  type Plan,
  type BillingPeriod,
} from "@/lib/plans";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export function PricingCards() {
  const [period, setPeriod] = React.useState<BillingPeriod>("annual");

  return (
    <div>
      {/* Billing-period selector */}
      <div className="flex justify-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-1 rounded-2xl bg-secondary p-1 text-sm">
          {BILLING_PERIODS.map((bp) => (
            <button
              key={bp.id}
              type="button"
              onClick={() => setPeriod(bp.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-medium transition-colors",
                period === bp.id
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {bp.label}
              {bp.badge && (
                <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                  {bp.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-5 lg:grid-cols-3">
        {PLAN_ORDER.map((id) => (
          <PlanCard key={id} plan={PLANS[id]} period={period} />
        ))}
      </div>

      <p className="mx-auto mt-6 max-w-xl text-center text-xs text-muted-foreground">
        All prices in PHP. Paid plans auto-renew at the shown price unless
        cancelled — cancel anytime and keep access until the period ends.
      </p>
    </div>
  );
}

function PlanCard({ plan, period }: { plan: Plan; period: BillingPeriod }) {
  const free = plan.id === "free";
  const price = planPrice(plan.id, period);
  const months = BILLING_PERIODS.find((b) => b.id === period)?.months ?? 1;
  const billedLabel =
    months === 1
      ? "billed monthly"
      : months === 12
        ? "billed yearly"
        : `billed every ${months} months`;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-6 shadow-soft",
        plan.highlighted ? "border-2 border-brand shadow-card" : "border-border",
      )}
    >
      {plan.label && (
        <span
          className={cn(
            "absolute -top-3 left-6 rounded-full px-3 py-0.5 text-xs font-medium",
            plan.highlighted
              ? "bg-brand text-primary-foreground"
              : "bg-secondary text-foreground",
          )}
        >
          {plan.label}
        </span>
      )}

      <h3 className="font-display text-xl">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

      <div className="mt-5 min-h-[104px]">
        {free ? (
          <p className="font-display text-4xl">
            Free
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              forever
            </span>
          </p>
        ) : price ? (
          <div>
            <p className="font-display text-4xl">
              {peso(price.monthlyEq)}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                /mo
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {peso(price.total)} {billedLabel}
            </p>
            {price.save > 0 && (
              <p className="mt-1 text-xs font-medium text-success">
                Save {peso(price.save)} · {price.discountPct}% off
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Renews at {peso(price.total)} unless cancelled
            </p>
          </div>
        ) : null}
      </div>

      <Link
        href="/signup"
        className={cn(
          "mt-4 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
          plan.highlighted
            ? "bg-brand text-primary-foreground shadow-soft hover:bg-brand-hover"
            : "border border-border hover:bg-secondary",
        )}
      >
        {plan.cta}
      </Link>

      <ul className="mt-6 space-y-2.5 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
              <CheckIcon className="size-3.5" />
            </span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
