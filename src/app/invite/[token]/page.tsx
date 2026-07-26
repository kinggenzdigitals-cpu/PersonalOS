/* eslint-disable react-hooks/purity -- async server component, renders per request */
import { createHash } from "crypto";
import Link from "next/link";
import type { Metadata } from "next";
import { SparklesIcon } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { AcceptInviteForm } from "@/components/invite/accept-invite-form";
import type { Invitation } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let inv: Invitation | null = null;
  try {
    const admin = createAdminClient();
    const hash = createHash("sha256").update(token).digest("hex");
    const { data } = await admin
      .from("user_invitations")
      .select("*")
      .eq("token_hash", hash)
      .maybeSingle<Invitation>();
    inv = data ?? null;
  } catch {
    inv = null;
  }

  const valid =
    !!inv &&
    inv.status === "pending" &&
    new Date(inv.invitation_expires_at).getTime() > Date.now();
  const planName = inv
    ? (PLANS[inv.selected_plan as "pro" | "premium"]?.name ?? inv.selected_plan)
    : "";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[400px] space-y-4">
        <div className="space-y-1 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand text-primary-foreground shadow-soft">
            <SparklesIcon className="size-6" />
          </span>
          <h1 className="font-display text-2xl tracking-tight">You&apos;re invited</h1>
        </div>

        {valid && inv ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
            <p className="text-center text-sm text-muted-foreground">
              You&apos;ve been given complimentary{" "}
              <span className="font-medium text-foreground">{planName}</span>{" "}
              access on Finance &amp; Habit Tracker.
            </p>
            <div className="space-y-1 rounded-lg bg-secondary/60 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Email:</span> {inv.email}
              </p>
              <p>
                <span className="text-muted-foreground">Valid until:</span>{" "}
                {inv.access_expires_at
                  ? new Date(inv.access_expires_at).toLocaleDateString()
                  : "No expiration"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Create a password to activate your account. This invitation can
              only be used by {inv.email}.
            </p>
            <AcceptInviteForm token={token} />
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-center shadow-card">
            <p className="text-sm text-muted-foreground">
              This invitation is invalid, expired, or has already been used.
            </p>
            <Button asChild variant="outline">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
