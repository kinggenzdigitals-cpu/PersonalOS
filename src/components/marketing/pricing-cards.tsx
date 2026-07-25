"use client";

import * as React from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, PLAN_ORDER, monthlyEquivalent, type Plan } from "@/lib/plans";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH")}`;
}

export function PricingCards() {
  const [yearly, setYearly] = React.useState(true);

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-full bg-secondary p-1 text-sm">
          <button
            type="button"
            onClick={() => setYearly(false)}
            className={cn(
              "rounded-full px-4 py-1.5 font-medium transition-colors",
              !yearly ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            className={cn(
              "rounded-full px-4 py-1.5 font-medium transition-colors",
              yearly ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
            )}
          >
            Yearly
          </button>
        </div>
        <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          Save 2 months
        </span>
      </div>

      <div className="mx-auto mt-8 grid max-w-3xl gap-5 sm:grid-cols-2">
        {PLAN_ORDER.map((id) => (
          <PlanCard key={id} plan={PLANS[id]} yearly={yearly} />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const isPro = plan.id === "pro";
  const free = plan.priceMonthly === 0;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-6 shadow-soft",
        plan.highlighted ? "border-brand shadow-card" : "border-border",
      )}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-0.5 text-xs font-medium text-primary-foreground">
          Most popular
        </span>
      )}
      <h3 className="font-display text-xl">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

      <div className="mt-5">
        {free ? (
          <p className="font-display text-4xl">Free</p>
        ) : yearly ? (
          <div>
            <p className="font-display text-4xl">
              {peso(monthlyEquivalent(plan))}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                /mo
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {peso(plan.priceYearly)} billed yearly
            </p>
          </div>
        ) : (
          <p className="font-display text-4xl">
            {peso(plan.priceMonthly)}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              /mo
            </span>
          </p>
        )}
      </div>

      <Link
        href="/signup"
        className={cn(
          "mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
          isPro
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
