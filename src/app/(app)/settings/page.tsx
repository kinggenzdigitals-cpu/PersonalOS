import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/nav/theme-toggle";
import { ExportButton } from "@/components/money/export-button";
import { DangerZone } from "@/components/settings/danger-zone";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await requireOnboardedProfile();

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
          <ExportButton />
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
