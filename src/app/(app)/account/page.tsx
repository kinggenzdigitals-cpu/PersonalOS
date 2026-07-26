import Link from "next/link";
import type { Metadata } from "next";
import {
  ChevronLeftIcon,
  CheckIcon,
  KeyRoundIcon,
  CreditCardIcon,
  SparklesIcon,
} from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlement";
import { getSubscription } from "@/lib/queries/billing";
import { PLANS } from "@/lib/plans";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Account & Subscription" };

function accessLabel(
  role: string,
  accessType: string | null,
  plan: string,
): string {
  if (role === "super_admin") return "Super Admin";
  if (accessType === "lifetime_pro") return "Lifetime Pro";
  if (accessType === "complimentary_pro") return "Complimentary Pro";
  return plan === "pro" ? "Pro" : "Free";
}

export default async function AccountPage() {
  const profile = await requireOnboardedProfile();
  const ent = await getEntitlement();
  const sub = await getSubscription();

  const label = accessLabel(ent.role, ent.accessType, ent.plan);
  const isPro = ent.plan === "pro";
  const complimentary =
    ent.role === "super_admin" ||
    ent.accessType === "lifetime_pro" ||
    ent.accessType === "complimentary_pro";
  const renewal = sub?.access_expires_at ?? sub?.current_period_end ?? null;
  const features = PLANS[isPro ? "pro" : "free"].features.filter(
    (f) => !f.startsWith("Everything"),
  );

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" /> Home
        </Link>
        <h1 className="font-display text-2xl tracking-tight">
          Account &amp; Subscription
        </h1>
      </header>

      {/* Account */}
      <Card className="shadow-card">
        <CardContent className="space-y-1 pt-6">
          <Row label="Full name" value={profile.display_name ?? "—"} />
          <Row label="Username" value={profile.username ? `@${profile.username}` : "—"} />
          <Row label="Email" value={ent.email ?? "—"} />
        </CardContent>
      </Card>

      {/* Plan */}
      <Card className="shadow-card">
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current plan</p>
              <p className="text-xs text-muted-foreground">
                {complimentary
                  ? "You have full Pro access — no payment or renewal needed."
                  : isPro
                    ? "You're on Pro. Thanks for supporting us!"
                    : "You're on the Free plan."}
              </p>
            </div>
            <span
              className={
                isPro
                  ? "rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
                  : "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              }
            >
              {label}
            </span>
          </div>

          <div className="space-y-1 border-t border-border pt-3">
            <Row label="Access type" value={label} />
            {sub?.status && <Row label="Subscription status" value={sub.status} />}
            {sub?.interval && !complimentary && (
              <Row label="Billing cycle" value={sub.interval} />
            )}
            {sub?.created_at && !complimentary && (
              <Row
                label="Started"
                value={new Date(sub.created_at).toLocaleDateString()}
              />
            )}
            {/* Renewal: only paid subscribers see a renewal/expiry date. */}
            {!complimentary && renewal && (
              <Row
                label="Renews / expires"
                value={new Date(renewal).toLocaleDateString()}
              />
            )}
            {ent.accessType === "complimentary_pro" && sub?.access_expires_at && (
              <Row
                label="Access until"
                value={new Date(sub.access_expires_at).toLocaleDateString()}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Included features */}
      <Card className="shadow-card">
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm font-medium">Included features</p>
          <ul className="space-y-2 text-sm">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                  <CheckIcon className="size-3.5" />
                </span>
                {f}
              </li>
            ))}
          </ul>
          {!isPro && (
            <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-sm">
              <p className="mb-0.5 flex items-center gap-1.5 font-medium text-brand">
                <SparklesIcon className="size-4" /> Unlock Pro
              </p>
              <p className="text-muted-foreground">
                Unlimited accounts, habits, budgets &amp; goals, net worth
                tracking, full report history, and CSV export.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" asChild>
          <Link href="/change-password">
            <KeyRoundIcon className="size-4" /> Change password
          </Link>
        </Button>
        {!complimentary && (
          <Button asChild>
            <Link href="/settings">
              <CreditCardIcon className="size-4" /> Manage subscription
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
