import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await requireOnboardedProfile();

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <Link
          href="/"
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

      <form action="/auth/signout" method="post">
        <Button variant="outline" type="submit" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
