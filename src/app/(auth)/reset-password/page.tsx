"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, LinkIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { toast } from "sonner";

type Status = "checking" | "ready" | "invalid";

/**
 * Supabase reports a dead link by appending an error to the URL — in the query
 * string when it comes via our callback, in the fragment when it redirects the
 * browser straight here. Returns user-facing copy, or null when the URL is
 * clean. Client-only: reads window.location.
 */
function readLinkFailure(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const text =
    hash.get("error_description") ??
    query.get("error_description") ??
    hash.get("error") ??
    query.get("error");
  if (!text) return null;
  const code = hash.get("error_code") ?? query.get("error_code");
  return code === "otp_expired"
    ? "That reset link has expired."
    : "That reset link is no longer valid.";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<Status>("checking");
  const [linkError, setLinkError] = React.useState<string | null>(null);

  /**
   * Establish that we actually hold a recovery session before showing the form.
   *
   * Previously the form rendered unconditionally, so a link that had expired,
   * been used already, or been opened in a different browser produced a normal-
   * looking form that failed on submit with a raw "Auth session missing!".
   *
   * Two link shapes land here:
   *  - the server callback already exchanged a `code`/`token_hash`, so a session
   *    cookie exists; or
   *  - Supabase returned the tokens in the URL *fragment* (implicit flow), which
   *    never reaches the server. supabase-js consumes that fragment while it
   *    initialises, and getSession() waits for that to finish.
   */
  React.useEffect(() => {
    let active = true;

    // Read the URL BEFORE creating the client: supabase-js strips auth params
    // out of the fragment while it initialises, so anything not captured here
    // is gone by the time getSession() resolves.
    const failure = readLinkFailure();
    const supabase = createClient();

    // Safety net: if the session lands slightly after the first check (fragment
    // parsing, token refresh), flip back to the form rather than stranding the
    // user on the error state.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setStatus("ready");
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        if (failure) {
          setLinkError(failure);
          setStatus("invalid");
          return;
        }
        if (data.session) {
          // Don't leave recovery tokens sitting in the address bar or history.
          window.history.replaceState(null, "", window.location.pathname);
          setStatus("ready");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => {
        if (active) setStatus("invalid");
      });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
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
        setLoading(false);
        // A session that lapsed between opening the link and submitting.
        if (/session|jwt|expired/i.test(error.message)) {
          setLinkError("That reset link expired before you finished.");
          setStatus("invalid");
          return;
        }
        toast.error(friendlyAuthError(error.message));
        return;
      }
      toast.success("Password updated.");
      router.replace("/home");
      router.refresh();
    } catch {
      setLoading(false);
      toast.error(friendlyAuthError("Failed to fetch"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-2xl tracking-tight">
          Set a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose something you&apos;ll remember.
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="pt-6">
          {status === "checking" && (
            <div
              className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
              role="status"
            >
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              Checking your link…
            </div>
          )}

          {status === "invalid" && (
            <div className="space-y-4 py-2 text-center">
              <LinkIcon
                className="mx-auto size-8 text-muted-foreground"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                {linkError ??
                  "This reset link is invalid, already used, or was opened in a different browser."}{" "}
                Request a new one and open it in the same browser.
              </p>
              <Button asChild className="w-full">
                <Link href="/forgot-password">Send a new link</Link>
              </Button>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
