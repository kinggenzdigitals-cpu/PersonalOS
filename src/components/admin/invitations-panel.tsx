"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addMonths } from "date-fns";
import { MailPlusIcon, CopyIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/components/money/form-sheet";
import { cn } from "@/lib/utils";
import {
  createInvitation,
  resendInvitation,
  revokeInvitation,
} from "@/app/(app)/admin/invitation-actions";
import type { Invitation, InvitationStatus } from "@/lib/supabase/types";

type Duration = "1m" | "3m" | "6m" | "1y" | "none" | "custom";

function durationToExpiry(d: Duration, customDate: string): string | null {
  const now = new Date();
  switch (d) {
    case "1m":
      return addMonths(now, 1).toISOString();
    case "3m":
      return addMonths(now, 3).toISOString();
    case "6m":
      return addMonths(now, 6).toISOString();
    case "1y":
      return addMonths(now, 12).toISOString();
    case "custom":
      return customDate ? new Date(customDate).toISOString() : null;
    default:
      return null;
  }
}

const STATUS_CLASS: Record<InvitationStatus, string> = {
  pending: "bg-warning/15 text-warning",
  accepted: "bg-success/15 text-success",
  expired: "bg-secondary text-muted-foreground",
  revoked: "bg-error/10 text-error",
};

function copy(link: string) {
  navigator.clipboard?.writeText(link).then(
    () => toast.success("Invitation link copied"),
    () => toast.error("Couldn't copy — select and copy manually"),
  );
}

export function InvitationsPanel({ invitations }: { invitations: Invitation[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Invite a friend or family member to complimentary access.
        </p>
        <InviteForm />
      </div>

      {invitations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No invitations yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Invitee</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Access expires</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <InviteRow key={inv.id} inv={inv} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InviteRow({ inv }: { inv: Invitation }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2">
        <p className="font-medium">{inv.full_name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{inv.email}</p>
      </td>
      <td className="px-3 py-2 capitalize">Complimentary {inv.selected_plan}</td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
            STATUS_CLASS[inv.status],
          )}
        >
          {inv.status}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {inv.access_expires_at
          ? new Date(inv.access_expires_at).toLocaleDateString()
          : "No expiration"}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          {inv.status !== "accepted" && inv.status !== "revoked" && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await resendInvitation(inv.id);
                setBusy(false);
                if (!res.ok) return toast.error(res.error);
                if (res.link) copy(res.link);
                router.refresh();
              }}
            >
              {busy ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
              Copy link
            </Button>
          )}
          {inv.status !== "revoked" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm("Revoke this invitation / access?")) return;
                setBusy(true);
                const res = await revokeInvitation(inv.id);
                setBusy(false);
                if (!res.ok) return toast.error(res.error);
                toast.success("Revoked");
                router.refresh();
              }}
            >
              Revoke
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [plan, setPlan] = React.useState<"pro" | "premium">("pro");
  const [duration, setDuration] = React.useState<Duration>("1y");
  const [customDate, setCustomDate] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [link, setLink] = React.useState<string | null>(null);

  return (
    <FormSheet
      title="Invite user"
      size="sm"
      trigger={
        <Button>
          <MailPlusIcon className="size-4" /> Invite user
        </Button>
      }
    >
      {() => (
        <div className="space-y-3">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
            />
          </Field>
          <Field label="Full name (optional)">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Plan">
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as "pro" | "premium")}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              <option value="pro">Complimentary Pro</option>
              <option value="premium">Complimentary Premium</option>
            </select>
          </Field>
          <Field label="Access duration">
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as Duration)}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
              <option value="none">No Expiration</option>
              <option value="custom">Custom date</option>
            </select>
          </Field>
          {duration === "custom" && (
            <Field label="Expiration date">
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </Field>
          )}
          <Field label="Personal message (optional)">
            <Textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>

          {link && (
            <div className="space-y-1 rounded-lg border border-brand/30 bg-brand/5 p-3 text-xs">
              <p className="font-medium text-brand">
                Email delivery is not configured — copy this link:
              </p>
              <div className="flex gap-2">
                <Input readOnly value={link} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copy(link)}
                >
                  <CopyIcon className="size-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setLink(null);
                const res = await createInvitation({
                  email,
                  fullName,
                  selectedPlan: plan,
                  expiresAt: durationToExpiry(duration, customDate),
                  message,
                });
                setBusy(false);
                if (!res.ok) return toast.error(res.error);
                toast.success(res.message);
                if (res.link) setLink(res.link);
                router.refresh();
              }}
            >
              {busy && <Loader2Icon className="size-4 animate-spin" />}
              Send invitation
            </Button>
          </div>
        </div>
      )}
    </FormSheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
