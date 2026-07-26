import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon, SparklesIcon, CreditCardIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlement";
import { PLANS, PLAN_PRICES } from "@/lib/plans";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeatureComparison } from "@/components/subscription/feature-comparison";

export const metadata: Metadata = { title: "Subscription" };

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export default async function SubscriptionPage() {
  await requireOnboardedProfile();
  const ent = await getEntitlement();
  const planName = PLANS[ent.plan].name;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href="/account"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" /> Account
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl tracking-tight">Subscription</h1>
          <span
            className={
              ent.plan === "free"
                ? "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                : "rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
            }
          >
            {planName} plan
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Higher limits, stronger automation, and advanced financial insights.
        </p>
      </header>

      {/* Plan summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(["free", "pro", "premium"] as const).map((id) => {
          const p = PLANS[id];
          const annual = id === "free" ? null : PLAN_PRICES[id].annual;
          const current = ent.plan === id;
          return (
            <Card
              key={id}
              className={current ? "border-2 border-brand shadow-card" : "shadow-soft"}
            >
              <CardContent className="space-y-1 pt-5">
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
                    <p className="tnum font-display text-2xl">
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
                  <p className="tnum font-display text-2xl">Free</p>
                )}
                {current ? (
                  <p className="pt-1 text-xs font-medium text-brand">
                    Your current plan
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/pricing">
            <SparklesIcon className="size-4" /> Explore all plans
          </Link>
        </Button>
        {ent.plan !== "premium" && !ent.isSuperAdmin && (
          <Button variant="outline" asChild>
            <Link href="/settings">
              <CreditCardIcon className="size-4" /> Manage subscription
            </Link>
          </Button>
        )}
      </div>

      {/* Complete feature comparison */}
      <section className="space-y-3">
        <h2 className="font-display text-lg">Compare plans</h2>
        <FeatureComparison currentPlan={ent.plan} />
        <p className="text-xs text-muted-foreground">
          Paid plans auto-renew at the shown price unless cancelled. Cancel
          anytime and keep access until the end of the paid period.
        </p>
      </section>
    </div>
  );
}
