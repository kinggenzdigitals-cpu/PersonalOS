"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2Icon, MailCheckIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getSiteURL } from "@/lib/site";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteURL()}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
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
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
