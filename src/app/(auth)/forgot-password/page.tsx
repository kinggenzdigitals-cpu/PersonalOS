"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2Icon, MailCheckIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getSiteURL } from "@/lib/site";
import { friendlyAuthError } from "@/lib/auth-errors";
import { toast } from "sonner";

/** Reason the auth callback bounced a recovery link back here. */
const LINK_ERRORS: Record<string, string> = {
  expired:
    "That reset link has expired or was already used. Enter your email for a fresh one.",
  invalid:
    "We couldn't read that reset link. Enter your email and we'll send a new one.",
};

export default function ForgotPasswordPage() {
  // useSearchParams needs a Suspense boundary so this route can still be
  // prerendered.
  return (
    <React.Suspense fallback={null}>
      <ForgotPassword />
    </React.Suspense>
  );
}

function ForgotPassword() {
  const params = useSearchParams();
  const linkError = LINK_ERRORS[params.get("error") ?? ""];

  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function send() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getSiteURL()}/auth/callback?next=%2Freset-password`,
      });
      if (error) {
        toast.error(friendlyAuthError(error.message));
        return;
      }
      setSent(true);
    } catch {
      // A thrown network failure (paused project, offline) rather than a
      // returned error.
      toast.error(friendlyAuthError("Failed to fetch"));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    await send();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-2xl tracking-tight">
          Reset your password
        </h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ll email you a secure link to set a new one.
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="pt-6">
          {sent ? (
            <div className="space-y-3 text-center">
              <MailCheckIcon
                className="mx-auto size-8 text-success"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                If an account exists for{" "}
                <span className="font-medium text-foreground">{email}</span>,
                a reset link is on its way.
              </p>
              <p className="text-xs text-muted-foreground">
                Open the link in this same browser — it&apos;s tied to this
                device. Check your spam folder if it hasn&apos;t arrived in a
                couple of minutes.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={send}
                disabled={loading}
              >
                {loading && (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                )}
                Send it again
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {linkError && (
                <p
                  role="alert"
                  className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error"
                >
                  {linkError}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                )}
                Send reset link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
