import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { AuthForm } from "@/components/auth/auth-form";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-2xl tracking-tight">
          Start your Finance & Habit Tracker
        </h1>
        <p className="text-sm text-muted-foreground">
          One calm place for money, habits, mood, and tasks.
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="space-y-4 pt-6">
          <GoogleSignIn next={next} />

          <AuthForm mode="signup" next={next} />

          {/* This is the moment the contract is formed, so the wording has to
              be both accurate and linked. It previously read "By continuing you
              agree to keep your data yours. We never share it." — which was
              false: running the service means sharing data with Supabase
              (database and auth, hosted in Singapore), Vercel (hosting) and,
              if you subscribe, Xendit (payments). It also linked neither
              document. Terms are AGREED to; the privacy policy is a NOTICE you
              are told about, not something to consent to — hence the different
              verbs. */}
          <p className="text-center text-xs text-muted-foreground">
            By creating an account you agree to our{" "}
            <Link
              href="/terms"
              className="font-medium text-brand underline underline-offset-4"
            >
              Terms of Service
            </Link>
            . See our{" "}
            <Link
              href="/privacy"
              className="font-medium text-brand underline underline-offset-4"
            >
              Privacy Policy
            </Link>{" "}
            for how your data is handled and who processes it.
          </p>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
