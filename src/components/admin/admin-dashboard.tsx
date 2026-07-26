"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MoreVerticalIcon,
  UserPlusIcon,
  Loader2Icon,
  UsersIcon,
  CreditCardIcon,
  GiftIcon,
  InfinityIcon,
  CircleSlashIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/components/money/form-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  setAccountStatus,
  setAccess,
  resetPassword,
  createComplimentaryAccount,
  updateFeedback,
} from "@/app/(app)/admin/actions";
import { STATUS_LABELS, STATUS_ORDER, CATEGORY_LABELS } from "@/lib/feedback";
import type { AdminUser, AdminSummary } from "@/lib/admin/users";
import type {
  AccessType,
  Feedback,
  FeedbackStatus,
} from "@/lib/supabase/types";

type Tab = "users" | "feedback";

export function AdminDashboard({
  users,
  summary,
  feedback,
}: {
  users: AdminUser[];
  summary: AdminSummary;
  feedback: Feedback[];
}) {
  const [tab, setTab] = React.useState<Tab>("users");
  const [q, setQ] = React.useState("");

  const filtered = users.filter((u) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (u.email ?? "").toLowerCase().includes(s) ||
      (u.fullName ?? "").toLowerCase().includes(s) ||
      (u.username ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryCard icon={UsersIcon} label="Total users" value={summary.total} />
        <SummaryCard icon={CreditCardIcon} label="Active paid" value={summary.activePaid} />
        <SummaryCard icon={GiftIcon} label="Complimentary" value={summary.complimentary} />
        <SummaryCard icon={InfinityIcon} label="Lifetime" value={summary.lifetime} />
        <SummaryCard icon={CircleSlashIcon} label="Expired / cancelled" value={summary.expiredCancelled} />
      </div>

      <div className="flex items-center gap-1 rounded-full bg-secondary p-1 text-sm w-fit">
        {(["users", "feedback"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-4 py-1.5 font-medium capitalize transition-colors",
              tab === t
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground",
            )}
          >
            {t === "users" ? "Users" : "Feedback"}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, username, or email"
              className="max-w-xs"
            />
            <CreateComplimentary />
          </div>
          <UsersTable users={filtered} />
        </div>
      ) : (
        <FeedbackTriage feedback={feedback} users={users} />
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-5">
        <span className="mb-1.5 grid size-8 place-items-center rounded-lg bg-secondary text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        <p className="tnum font-display text-2xl">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function planBadge(u: AdminUser): { label: string; className: string } {
  if (u.role === "super_admin")
    return { label: "Super Admin", className: "bg-brand text-primary-foreground" };
  if (u.accessType === "lifetime_pro")
    return { label: "Lifetime Pro", className: "bg-brand/10 text-brand" };
  if (u.accessType === "complimentary_pro" && u.plan === "pro")
    return { label: "Complimentary", className: "bg-brand-2/15 text-brand-2" };
  if (u.plan === "pro")
    return { label: "Pro", className: "bg-success/15 text-success" };
  return { label: "Free", className: "bg-secondary text-muted-foreground" };
}

function UsersTable({ users }: { users: AdminUser[] }) {
  if (users.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        No users match your search.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">User</th>
            <th className="px-3 py-2 font-medium">Plan</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Renew / expires</th>
            <th className="px-3 py-2 font-medium">Last login</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow key={u.userId} u={u} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ u }: { u: AdminUser }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const badge = planBadge(u);

  async function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Something went wrong.");
      return;
    }
    toast.success(res.message ?? "Done.", { duration: 8000 });
    router.refresh();
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2">
        <p className="font-medium">{u.fullName ?? u.username ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{u.email}</p>
        {u.username && (
          <p className="text-[11px] text-muted-foreground">@{u.username}</p>
        )}
      </td>
      <td className="px-3 py-2">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge.className)}>
          {badge.label}
        </span>
      </td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "text-xs",
            u.status === "active" ? "text-muted-foreground" : "text-error",
          )}
        >
          {u.status}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {u.renewalOrExpiry
          ? new Date(u.renewalOrExpiry).toLocaleDateString()
          : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        {u.role === "super_admin" ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={busy}
                aria-label="Actions"
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                {busy ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <MoreVerticalIcon className="size-4" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => run(() => setAccess(u.userId, "complimentary_pro", null))}
              >
                Grant Complimentary Pro
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => run(() => setAccess(u.userId, "lifetime_pro", null))}
              >
                Grant Lifetime Pro
              </DropdownMenuItem>
              {u.accessType && (
                <DropdownMenuItem
                  onClick={() =>
                    run(
                      () => setAccess(u.userId, null, null),
                      "Remove Pro access from this user?",
                    )
                  }
                >
                  Remove Pro access
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() =>
                  run(
                    () => resetPassword(u.userId),
                    "Reset this user's password? A temporary one will be shown.",
                  )
                }
              >
                Reset password
              </DropdownMenuItem>
              {u.status === "active" ? (
                <DropdownMenuItem
                  onClick={() =>
                    run(
                      () => setAccountStatus(u.userId, "suspended"),
                      "Suspend this account? They will be locked out.",
                    )
                  }
                >
                  Suspend account
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => run(() => setAccountStatus(u.userId, "active"))}
                >
                  Reactivate account
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() =>
                  run(
                    () => setAccountStatus(u.userId, "revoked"),
                    "Revoke access entirely? This also removes complimentary Pro.",
                  )
                }
              >
                Revoke access
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}

function CreateComplimentary() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [accessType, setAccessType] =
    React.useState<Exclude<AccessType, "paid">>("complimentary_pro");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <FormSheet
      title="Create complimentary account"
      trigger={
        <Button variant="outline">
          <UserPlusIcon className="size-4" /> New account
        </Button>
      }
    >
      {(close) => (
        <div className="space-y-3">
          <Field label="Full name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Username (unique)">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Access type">
            <select
              value={accessType}
              onChange={(e) =>
                setAccessType(e.target.value as Exclude<AccessType, "paid">)
              }
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              <option value="complimentary_pro">Complimentary Pro</option>
              <option value="lifetime_pro">Lifetime Pro</option>
            </select>
          </Field>
          {accessType === "complimentary_pro" && (
            <Field label="Expiration (optional)">
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </Field>
          )}
          <Button
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await createComplimentaryAccount({
                email,
                fullName,
                username,
                accessType,
                expiresAt: expiresAt || null,
              });
              setBusy(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(res.message ?? "Created.", { duration: 12000 });
              router.refresh();
              close();
            }}
          >
            {busy && <Loader2Icon className="size-4 animate-spin" />}
            Create account
          </Button>
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

function FeedbackTriage({
  feedback,
  users,
}: {
  feedback: Feedback[];
  users: AdminUser[];
}) {
  const emailById = new Map(users.map((u) => [u.userId, u.email]));
  const [showArchived, setShowArchived] = React.useState(false);
  const visible = feedback.filter((f) => showArchived || !f.archived);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived
      </label>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No feedback yet.
        </p>
      ) : (
        visible.map((f) => (
          <FeedbackItem key={f.id} f={f} email={emailById.get(f.user_id) ?? null} />
        ))
      )}
    </div>
  );
}

function FeedbackItem({ f, email }: { f: Feedback; email: string | null }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<FeedbackStatus>(f.status);
  const [response, setResponse] = React.useState(f.admin_response ?? "");
  const [note, setNote] = React.useState(f.admin_note ?? "");
  const [busy, setBusy] = React.useState(false);

  async function save(extra?: { isDuplicate?: boolean; archived?: boolean }) {
    setBusy(true);
    const res = await updateFeedback(f.id, {
      status,
      adminResponse: response,
      adminNote: note,
      ...extra,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Saved.");
    router.refresh();
  }

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{f.title}</p>
            <p className="text-xs text-muted-foreground">
              {CATEGORY_LABELS[f.category]} · {email ?? "unknown"} ·{" "}
              {new Date(f.created_at).toLocaleDateString()}
              {f.is_duplicate ? " · duplicate" : ""}
            </p>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {f.message}
        </p>
        {f.screenshot_url && (
          <a
            href={f.screenshot_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-2 underline"
          >
            View screenshot
          </a>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
              className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Response to the user (visible to them)"
          rows={2}
        />
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Internal note (never shown to the user)"
          rows={2}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => save()}>
            {busy && <Loader2Icon className="size-4 animate-spin" />} Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => save({ isDuplicate: !f.is_duplicate })}
          >
            {f.is_duplicate ? "Unmark duplicate" : "Mark duplicate"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => save({ archived: !f.archived })}
          >
            {f.archived ? "Unarchive" : "Archive"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
