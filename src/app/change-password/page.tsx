import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ChangePasswordPage() {
  await requireUser();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] space-y-4">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-2xl tracking-tight">
            Set a new password
          </h1>
          <p className="text-sm text-muted-foreground">
            For your security, please replace your temporary password before
            continuing.
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
