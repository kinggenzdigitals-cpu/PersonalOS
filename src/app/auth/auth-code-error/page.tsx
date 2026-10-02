import Link from "next/link";
import type { Metadata } from "next";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCOUNT_SUSPENDED_MESSAGE } from "@/lib/auth-errors";

export const metadata: Metadata = { title: "Sign-in problem" };

/**
 * `?reason=suspended` is set by /auth/callback when GoTrue refuses a banned
 * account, so a suspended holder arriving through Google or an email link
 * reads the same explanation the password form shows — "try again" would be
 * false, and /suspended needs a session they no longer have.
 */
export default async function AuthCodeErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const suspended = reason === "suspended";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[400px] space-y-4 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-error/10 text-error">
          <AlertCircleIcon className="size-6" />
        </span>
        <div className="space-y-1">
          <h1 className="font-display text-2xl tracking-tight">
            {suspended
              ? "Account suspended"
              : "We couldn't complete your Google sign-in"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {suspended
              ? ACCOUNT_SUSPENDED_MESSAGE
              : "Please try again. If the problem continues, use email and password or contact support."}
          </p>
        </div>
        <div className="space-y-2">
          {/* Retrying can only fail again while the account is banned. */}
          {!suspended && (
            <>
              <Button asChild className="w-full">
                <Link href="/login">Try Google again</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Use email and password</Link>
              </Button>
            </>
          )}
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">Back to login</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
