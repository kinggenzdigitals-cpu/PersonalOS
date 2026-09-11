import Link from "next/link";
import { CheckCircle2Icon } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { AuthForm } from "@/components/auth/auth-form";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; signedOut?: string }>;
}) {
  const { next, signedOut } = await searchParams;
  const wasSignedOut = signedOut === "1";

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-2xl tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to pick up where you left off.
        </p>
      </div>

      {wasSignedOut && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-foreground"
        >
          <CheckCircle2Icon
            className="mt-0.5 size-4 shrink-0 text-success"
            aria-hidden
          />
          <p>
            You’re signed out. To return, use the same sign-in method you used
            before.
          </p>
        </div>
      )}

      <Card className="shadow-card">
        <CardContent className="space-y-4 pt-6">
          <GoogleSignIn next={next} returning />

          <AuthForm mode="login" next={next} />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
