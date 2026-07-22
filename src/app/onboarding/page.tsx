import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarded")
    .eq("user_id", user.id)
    .single();

  if (profile?.onboarded) redirect("/");

  const suggestedName =
    profile?.display_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl tracking-tight">
          Let&apos;s set up your Life OS
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A minute now saves scattered spreadsheets later.
        </p>
      </div>
      <OnboardingWizard initialName={suggestedName} />
    </main>
  );
}
