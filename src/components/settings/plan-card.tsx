"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SparklesIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSheet } from "@/components/money/form-sheet";
import { cn } from "@/lib/utils";
import {
  PLANS,
  PLAN_PRICES,
  BILLING_PERIODS,
  type PlanId,
  type BillingPeriod,
} from "@/lib/plans";
import { redeemPromoCode, startCheckout } from "@/app/(app)/settings/billing-actions";
import {
  cancelSubscription,
  resumeSubscription,
} from "@/app/(app)/settings/subscription-actions";
import { toast } from "sonner";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export function PlanCard({
  plan,
  periodEndLabel = null,
  cancelAtPeriodEnd = false,
  canManageRenewal = false,
}: {
  plan: PlanId;
  /** Pre-formatted on the server — formatting here would mismatch on hydration. */
  periodEndLabel?: string | null;
  cancelAtPeriodEnd?: boolean;
  /** Only a genuinely paid subscription can be cancelled or resumed. */
  canManageRenewal?: boolean;
}) {
  const router = useRouter();
  const isFree = plan === "free";
  const [tier, setTier] = React.useState<"pro" | "premium">(
    plan === "free" ? "pro" : "premium",
  );
  const [period, setPeriod] = React.useState<BillingPeriod>("annual");
  const [busy, setBusy] = React.useState(false);
  const [promoCode, setPromoCode] = React.useState("");
  const [promoBusy, setPromoBusy] = React.useState(false);
  const [lifecycleBusy, setLifecycleBusy] = React.useState(false);

  /** Returns whether the change actually went through. */
  async function setRenewal(on: boolean): Promise<boolean> {
    setLifecycleBusy(true);
    try {
      const res = on ? await resumeSubscription() : await cancelSubscription();
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
      router.refresh();
      toast.success(res.message);
      return true;
    } catch {
      // A rejected action (network drop, server throw) must still release the
      // button — otherwise both dialog controls stay disabled with no message.
      toast.error("Something went wrong. Please try again.");
      return false;
    } finally {
      setLifecycleBusy(false);
    }
  }

  const renewLabel = periodEndLabel;

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

  async function applyPromo() {
    setPromoBusy(true);
    const res = await redeemPromoCode(promoCode);
    setPromoBusy(false);
    if (!res.ok) return toast.error(res.error);
    if (res.free) {
      toast.success(res.message);
      setPromoCode("");
      router.refresh();
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
            {price.save > 0 && ` · save ${peso(price.save)}`} · one-off payment,
            no card stored
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

        <div className="rounded-xl border border-dashed border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Promo code</p>
          <div className="mt-2 flex gap-2">
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="font-mono text-sm"
            />
            <Button type="button" variant="outline" disabled={promoBusy} onClick={applyPromo}>
              {promoBusy && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
              Apply
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Free promos activate now. Paid promo codes open a one-time checkout and do not auto-renew.
          </p>
        </div>

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
                : "rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-brand-foreground"
            }
          >
            {PLANS[plan].name}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {renewLabel && !isFree && (
            <p className="text-xs text-muted-foreground">
              {cancelAtPeriodEnd ? (
                <>
                  Renewal is off. You keep {PLANS[plan].name} until{" "}
                  <span className="font-medium text-foreground">
                    {renewLabel}
                  </span>
                  , then move to Free.
                </>
              ) : (
                <>
                  Access active until{" "}
                  <span className="font-medium text-foreground">
                    {renewLabel}
                  </span>
                  . Renew anytime to extend — you keep any remaining time.
                </>
              )}
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

          {!isFree && canManageRenewal && (
            <>
              {cancelAtPeriodEnd ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setRenewal(true)}
                  disabled={lifecycleBusy}
                >
                  {lifecycleBusy && (
                    <Loader2Icon className="size-4 animate-spin" aria-hidden />
                  )}
                  Keep my plan
                </Button>
              ) : (
                <FormSheet
                  title="Turn off renewal"
                  size="sm"
                  trigger={
                    <Button
                      variant="ghost"
                      className="w-full text-muted-foreground"
                    >
                      Cancel subscription
                    </Button>
                  }
                >
                  {(close) => (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        You keep full {PLANS[plan].name} access
                        {renewLabel ? ` until ${renewLabel}` : ""}, then move to
                        the Free plan. Nothing is charged and nothing is
                        refunded — your payment already covers this period.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Your data stays exactly as it is. You can turn renewal
                        back on at any time.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={close}
                          disabled={lifecycleBusy}
                        >
                          Keep my plan
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          disabled={lifecycleBusy}
                          onClick={async () => {
                            // Only dismiss when it actually worked, so a
                            // failure stays visible in context.
                            if (await setRenewal(false)) close();
                          }}
                        >
                          {lifecycleBusy && (
                            <Loader2Icon
                              className="size-4 animate-spin"
                              aria-hidden
                            />
                          )}
                          Turn off renewal
                        </Button>
                      </div>
                    </div>
                  )}
                </FormSheet>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
