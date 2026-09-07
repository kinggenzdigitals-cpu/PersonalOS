import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import {
  getActivePlan,
  getSubscription,
  canManageRenewal,
} from "@/lib/queries/billing";
import { PLANS } from "@/lib/plans";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/money/export-button";
import { DownloadDataButton } from "@/components/settings/download-data-button";
import { PlanCard } from "@/components/settings/plan-card";
import { ThemeSettings } from "@/components/settings/theme-settings";
import { DangerZone } from "@/components/settings/danger-zone";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; checkout?: string }>;
}) {
  const profile = await requireOnboardedProfile();
  const plan = await getActivePlan();
  const subscription = await getSubscription();
  const sp = await searchParams;

  // Formatted here, in the user's own timezone. Formatting a date inside the
  // client component would render UTC on the server and local time in the
  // browser — a hydration mismatch on the very date the cancel copy relies on.
  const periodEndLabel = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: profile.timezone,
      })
    : null;

  // Only a genuinely paid, still-running subscription can be cancelled or
  // resumed — not complimentary/lifetime grants, and not super admins (whose
  // entitlement is synthesised and has no subscription row at all).
  const manageRenewal = await canManageRenewal();

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" /> Home
        </Link>
        <h1 className="font-display text-2xl tracking-tight">Settings</h1>
      </header>

      {sp.upgraded === "1" && (
        <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground">
          <p className="font-medium">Payment received — thank you! 🎉</p>
          <p className="text-muted-foreground">
            {plan === "free"
              ? "Your upgrade will activate in a moment. Refresh this page shortly."
              : `You're on ${PLANS[plan].name} now. Enjoy everything Finance & Habit Tracker has to offer.`}
          </p>
        </div>
      )}
      {sp.checkout === "failed" && (
        <div className="rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Checkout was cancelled. No charge was made — you can try again anytime.
        </div>
      )}

      <PlanCard
        plan={plan}
        periodEndLabel={periodEndLabel}
        cancelAtPeriodEnd={subscription?.cancel_at_period_end ?? false}
        canManageRenewal={manageRenewal}
      />

      <Card className="shadow-card">
        <CardContent className="pt-6">
          <SettingsForm profile={profile} />
        </CardContent>
      </Card>

      <ThemeSettings />

      <Card className="shadow-card">
        <CardContent className="space-y-3 pt-6">
          <div>
            <p className="text-sm font-medium">Your data</p>
            <p className="text-xs text-muted-foreground">
              Download your transactions as a spreadsheet, or take a full copy
              of everything in your account.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton canExport={PLANS[plan].limits.csvExport === true} />
            <DownloadDataButton />
          </div>
        </CardContent>
      </Card>

      <form action="/auth/signout" method="post">
        <Button variant="outline" type="submit" className="w-full">
          Sign out
        </Button>
      </form>

      <DangerZone />
    </div>
  );
}
