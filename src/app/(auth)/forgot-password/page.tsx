"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { OtpInput } from "@/components/auth/otp-input";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = ["Email", "Verify code", "New password"] as const;
type Step = 0 | 1 | 2;

const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;

/** Reason the auth callback bounced a recovery link back here. */
const LINK_ERRORS: Record<string, string> = {
  expired: "That reset link has expired. Request a new code below.",
  invalid: "We couldn't read that reset link. Request a new code below.",
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
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = React.useState<Step>(0);
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [notice, setNotice] = React.useState<string | null>(
    LINK_ERRORS[params.get("error") ?? ""] ?? null,
  );

  // Resend countdown.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  /**
   * Send the recovery email.
   *
   * The email carries a 6-digit code ({{ .Token }} in the Supabase template).
   * A code beats a magic link here: the link only works in the browser that
   * requested it, so anyone who opened it on their phone got a dead link — the
   * single most common way this flow failed.
   */
  async function sendCode(target: string) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(target);
      if (error) {
        // Keep the raw error where a developer can find it; show friendly copy.
        console.error("[forgot-password] send failed:", error);
        toast.error(friendlyAuthError(error.message));
        return false;
      }
      setCooldown(RESEND_SECONDS);
      return true;
    } catch (err) {
      console.error("[forgot-password] send threw:", err);
      toast.error(friendlyAuthError("Failed to fetch"));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    const target = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setEmail(target);
    if (await sendCode(target)) {
      setNotice(null);
      setCode("");
      setStep(1);
    }
  }

  /** Exchange the emailed code for a short-lived recovery session. */
  async function verify(value: string) {
    if (value.length !== CODE_LENGTH) {
      toast.error(`Enter all ${CODE_LENGTH} digits.`);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: value,
        type: "recovery",
      });
      if (error) {
        console.error("[forgot-password] verify failed:", error);
        toast.error(friendlyAuthError(error.message));
        setCode("");
        return;
      }
      setStep(2);
    } catch (err) {
      console.error("[forgot-password] verify threw:", err);
      toast.error(friendlyAuthError("Failed to fetch"));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error("[forgot-password] update failed:", error);
        setLoading(false);
        // The recovery session lapsed between verifying and submitting.
        if (/session|jwt|expired/i.test(error.message)) {
          setNotice("That took too long — request a new code.");
          setCode("");
          setStep(0);
          return;
        }
        toast.error(friendlyAuthError(error.message));
        return;
      }
      toast.success("Password updated.");
      router.replace("/home");
      router.refresh();
    } catch (err) {
      console.error("[forgot-password] update threw:", err);
      setLoading(false);
      toast.error(friendlyAuthError("Failed to fetch"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-2xl tracking-tight">
          Reset your password
        </h1>
      </div>

      <Card className="shadow-card">
        <CardContent className="space-y-5 pt-6">
          <Stepper current={step} />

          {notice && (
            <p
              role="alert"
              className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error"
            >
              {notice}
            </p>
          )}

          {step === 0 && (
            <form onSubmit={onSubmitEmail} className="space-y-4" noValidate>
              <div className="space-y-1">
                <h2 className="font-display text-lg">Forgot password</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the email address associated with your account and
                  we&apos;ll send you a verification code.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">
                  Email address <span className="text-error">*</span>
                </Label>
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
                Send verification code
              </Button>
            </form>
          )}

          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verify(code);
              }}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-1">
                <h2 className="font-display text-lg">Enter the code</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a {CODE_LENGTH}-digit code to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                  It expires in about an hour.
                </p>
              </div>

              <OtpInput
                value={code}
                onChange={setCode}
                onComplete={(v) => void verify(v)}
                length={CODE_LENGTH}
                disabled={loading}
                autoFocus
              />

              <Button
                type="submit"
                className="w-full"
                disabled={loading || code.length !== CODE_LENGTH}
              >
                {loading && (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                )}
                Verify code
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep(0);
                    setCode("");
                  }}
                  className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  <ArrowLeftIcon className="size-3.5" aria-hidden />
                  Change email
                </button>
                <button
                  type="button"
                  disabled={loading || cooldown > 0}
                  onClick={() => void sendCode(email)}
                  className="text-brand underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Can&apos;t find it? Check your spam folder.
              </p>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={onSubmitPassword} className="space-y-4" noValidate>
              <div className="space-y-1">
                <h2 className="font-display text-lg">Set a new password</h2>
                <p className="text-sm text-muted-foreground">
                  Choose something you&apos;ll remember — at least 8 characters.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <PasswordInput
                  id="confirm"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                )}
                Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden />
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  return (
    <ol className="flex gap-2">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex-1 space-y-1.5">
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                done || active ? "bg-brand" : "bg-border",
              )}
            />
            <span
              className={cn(
                "block text-[11px] font-medium transition-colors",
                active
                  ? "text-brand"
                  : done
                    ? "text-foreground"
                    : "text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
