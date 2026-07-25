import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getActivePlan, getSubscription } from "@/lib/queries/billing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/nav/theme-toggle";
import { ExportButton } from "@/components/money/export-button";
import { PlanCard } from "@/components/settings/plan-card";
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
            {plan === "pro"
              ? "You're on Pro now. Enjoy everything Life OS has to offer."
              : "Your Pro upgrade will activate in a moment. Refresh this page shortly."}
          </p>
        </div>
      )}
      {sp.checkout === "failed" && (
        <div className="rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Checkout was cancelled. No charge was made — you can try again anytime.
        </div>
      )}

      <PlanCard plan={plan} periodEnd={subscription?.current_period_end ?? null} />

      <Card className="shadow-card">
        <CardContent className="pt-6">
          <SettingsForm profile={profile} />
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="flex items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-sm font-medium">Appearance</p>
            <p className="text-xs text-muted-foreground">
              Switch between light and dark.
            </p>
          </div>
          <ThemeToggle className="border border-border" />
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="space-y-3 pt-6">
          <div>
            <p className="text-sm font-medium">Your data</p>
            <p className="text-xs text-muted-foreground">
              Download a copy of your transactions as a spreadsheet.
            </p>
          </div>
          <ExportButton canExport={plan === "pro"} />
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
