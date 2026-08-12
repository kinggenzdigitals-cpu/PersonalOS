"use client";

import * as React from "react";
import { SparklesIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { cn } from "@/lib/utils";
import {
  PLANS,
  PLAN_PRICES,
  BILLING_PERIODS,
  type PlanId,
  type BillingPeriod,
} from "@/lib/plans";
import { startCheckout } from "@/app/(app)/settings/billing-actions";
import { toast } from "sonner";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export function PlanCard({
  plan,
  periodEnd = null,
}: {
  plan: PlanId;
  periodEnd?: string | null;
}) {
  const isFree = plan === "free";
  const [tier, setTier] = React.useState<"pro" | "premium">(
    plan === "free" ? "pro" : "premium",
  );
  const [period, setPeriod] = React.useState<BillingPeriod>("annual");
  const [busy, setBusy] = React.useState(false);

  const renewLabel = periodEnd
    ? new Date(periodEnd).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  async function checkout() {
    setBusy(true);
    const res = await startCheckout(tier, period);
    if (!res.ok) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    window.location.assign(res.url);
  }

  const checkoutBody = () => {
    const price = PLAN_PRICES[tier][period];
    const p = PLANS[tier];
    return (
      <div className="space-y-4">
        {/* Tier */}
        <div className="inline-flex w-full gap-1 rounded-full bg-secondary p-1 text-sm">
          {(["pro", "premium"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={cn(
                "flex-1 rounded-full py-1.5 font-medium transition-colors",
                tier === t
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              {PLANS[t].name}
            </button>
          ))}
        </div>
        {/* Billing period */}
        <div className="grid grid-cols-4 gap-1 rounded-full bg-secondary p-1 text-xs">
          {BILLING_PERIODS.map((bp) => (
            <button
              key={bp.id}
              type="button"
              onClick={() => setPeriod(bp.id)}
              className={cn(
                "rounded-full py-1.5 font-medium transition-colors",
                period === bp.id
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              {bp.label}
            </button>
          ))}
        </div>

        <div>
          <p className="font-display text-2xl">
            {peso(price.total)}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              total
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {peso(price.monthlyEq)}/mo
            {price.save > 0 && ` · save ${peso(price.save)}`} · renews at{" "}
            {peso(price.total)} unless cancelled
          </p>
        </div>

        <ul className="space-y-2 text-sm">
          {p.features
            .filter((f) => !f.startsWith("Everything"))
            .slice(0, 5)
            .map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                  <CheckIcon className="size-3.5" />
                </span>
                {f}
              </li>
            ))}
        </ul>

        <p className="text-center text-xs text-muted-foreground">
          Pay with GCash, Maya, card, or bank transfer via Xendit.
        </p>

        <Button className="w-full" onClick={checkout} disabled={busy}>
          {busy && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
          Continue to payment
        </Button>
      </div>
    );
  };

  return (
    <Card className="shadow-card">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Plan</p>
            <p className="text-xs text-muted-foreground">
              {isFree
                ? "You're on the Free plan"
                : `You're on ${PLANS[plan].name} — thank you!`}
            </p>
          </div>
          <span
            className={
              isFree
                ? "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                : "rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
            }
          >
            {PLANS[plan].name}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {renewLabel && !isFree && (
            <p className="text-xs text-muted-foreground">
              Access active until{" "}
              <span className="font-medium text-foreground">{renewLabel}</span>.
              Renew anytime to extend.
            </p>
          )}
          <FormSheet
            title={isFree ? "Upgrade your plan" : "Upgrade or renew"}
            size="md"
            trigger={
              <Button className="w-full">
                <SparklesIcon className="size-4" />{" "}
                {isFree ? "Upgrade" : "Upgrade or renew"}
              </Button>
            }
          >
            {checkoutBody}
          </FormSheet>
        </div>
      </CardContent>
    </Card>
  );
}
