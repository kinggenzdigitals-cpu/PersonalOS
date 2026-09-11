import type { Metadata } from "next";
import { getProfile, requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata: Metadata = { title: "Set or create password" };

export default async function ChangePasswordPage() {
  await requireUser();
  const profile = await getProfile();
  const forced = Boolean(profile?.must_change_password);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] space-y-4">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-2xl tracking-tight">
            {forced ? "Set a new password" : "Set or create password"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {forced
              ? "For your security, please replace your temporary password before continuing."
              : "Create a Finance Tracker password for this same account. This never uses or stores your Google/Gmail password."}
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
