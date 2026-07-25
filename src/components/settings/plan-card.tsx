"use client";

import * as React from "react";
import { SparklesIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { cn } from "@/lib/utils";
import { PLANS, monthlyEquivalent, type PlanId } from "@/lib/plans";
import { startProCheckout } from "@/app/(app)/settings/billing-actions";
import { toast } from "sonner";

export function PlanCard({
  plan,
  periodEnd = null,
}: {
  plan: PlanId;
  periodEnd?: string | null;
}) {
  const isPro = plan === "pro";
  const pro = PLANS.pro;
  const [interval, setInterval] = React.useState<"monthly" | "yearly">(
    "yearly",
  );
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
    const res = await startProCheckout(interval);
    if (!res.ok) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    window.location.href = res.url;
  }

  const checkoutBody = () => (
    <div className="space-y-4">
      {/* Billing interval */}
      <div className="inline-flex w-full items-center gap-1 rounded-full bg-secondary p-1 text-sm">
        {(["monthly", "yearly"] as const).map((iv) => (
          <button
            key={iv}
            type="button"
            onClick={() => setInterval(iv)}
            className={cn(
              "flex-1 rounded-full py-1.5 font-medium capitalize transition-colors",
              interval === iv
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground",
            )}
          >
            {iv}
          </button>
        ))}
      </div>

      <div>
        <p className="font-display text-2xl">
          ₱
          {(interval === "yearly"
            ? monthlyEquivalent(pro)
            : pro.priceMonthly
          ).toLocaleString("en-PH")}
          <span className="text-base font-normal text-muted-foreground">
            {" "}
            /mo
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {interval === "yearly"
            ? `₱${pro.priceYearly.toLocaleString("en-PH")} billed yearly · save 2 months`
            : "Billed monthly"}
        </p>
      </div>

      <ul className="space-y-2 text-sm">
        {pro.features
          .filter((f) => !f.startsWith("Everything"))
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

  return (
    <Card className="shadow-card">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Plan</p>
            <p className="text-xs text-muted-foreground">
              {isPro ? "You're on Pro — thank you!" : "You're on the Free plan"}
            </p>
          </div>
          <span
            className={
              isPro
                ? "rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
                : "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            }
          >
            {isPro ? "Pro" : "Free"}
          </span>
        </div>

        {!isPro && (
          <div className="mt-4">
            <FormSheet
              title="Upgrade to Pro"
              trigger={
                <Button className="w-full">
                  <SparklesIcon className="size-4" /> Upgrade to Pro
                </Button>
              }
            >
              {checkoutBody}
            </FormSheet>
          </div>
        )}

        {isPro && (
          <div className="mt-4 space-y-3">
            {renewLabel && (
              <p className="text-xs text-muted-foreground">
                Your Pro access is active until{" "}
                <span className="font-medium text-foreground">{renewLabel}</span>
                . It will not auto-charge — renew anytime to extend.
              </p>
            )}
            <FormSheet
              title="Renew Pro"
              trigger={
                <Button variant="outline" className="w-full">
                  <SparklesIcon className="size-4" /> Renew or extend
                </Button>
              }
            >
              {checkoutBody}
            </FormSheet>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
