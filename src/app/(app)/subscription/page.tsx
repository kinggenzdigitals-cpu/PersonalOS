import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon, SparklesIcon, CreditCardIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlement";
import { getUsage } from "@/lib/queries/usage";
import { PLANS } from "@/lib/plans";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeatureComparison } from "@/components/subscription/feature-comparison";
import { UsageMeters } from "@/components/subscription/usage-meters";
import { PlanCards } from "@/components/subscription/plan-cards";

export const metadata: Metadata = { title: "Subscription" };

export default async function SubscriptionPage() {
  const profile = await requireOnboardedProfile();
  const [ent, usage] = await Promise.all([
    getEntitlement(),
    getUsage(profile.timezone),
  ]);
  const planName = PLANS[ent.plan].name;
  const complimentary =
    ent.isSuperAdmin ||
    ent.accessType === "lifetime_pro" ||
    ent.accessType === "complimentary_pro";

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
      <PlanCards
        currentPlan={ent.plan}
        usage={usage}
        complimentary={complimentary}
      />

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

      {/* Current usage */}
      <Card className="shadow-card">
        <CardContent className="space-y-4 pt-6">
          <div>
            <p className="text-sm font-medium">Your usage</p>
            <p className="text-xs text-muted-foreground">
              How much of your {planName} plan you&apos;re using right now.
            </p>
          </div>
          <UsageMeters usage={usage} plan={ent.plan} />
        </CardContent>
      </Card>

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
