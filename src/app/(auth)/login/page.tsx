import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { AuthForm } from "@/components/auth/auth-form";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-2xl tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to pick up where you left off.
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="space-y-4 pt-6">
          {/* Streams in behind the form: asking Supabase whether Google is on
              must never stand between the user and the email fields. The
              fallback is empty rather than a skeleton because the button is
              usually absent, and a placeholder for something that normally
              never arrives is worse than nothing. */}
          <Suspense fallback={null}>
            <GoogleSignIn next={next} />
          </Suspense>

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
