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
  BadgeDollarSignIcon,
  CrownIcon,
  TicketPercentIcon,
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
  grantTimedAccess,
  extendUserAccess,
  cancelUserSubscription,
  createPromoCode,
  setPromoCodeActive,
} from "@/app/(app)/admin/actions";
import { STATUS_LABELS, STATUS_ORDER, CATEGORY_LABELS } from "@/lib/feedback";
import type { AdminPromoCode, AdminSummary, AdminUser } from "@/lib/admin/users";
import { InvitationsPanel } from "@/components/admin/invitations-panel";
import { AuditPanel } from "@/components/admin/audit-panel";
import type { AuditEntry } from "@/lib/admin/audit";
import type {
  AccessType,
  Feedback,
  FeedbackStatus,
  Invitation,
} from "@/lib/supabase/types";

type Tab = "users" | "promos" | "invitations" | "feedback" | "audit";

function adminDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function peso(value: number | null | undefined) {
  if (value == null) return "—";
  return `₱${Number(value).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export function AdminDashboard({
  users,
  summary,
  feedback,
  invitations,
  auditLog,
  promoCodes,
  canManageAccounts = true,
}: {
  users: AdminUser[];
  summary: AdminSummary;
  feedback: Feedback[];
  invitations: Invitation[];
  auditLog: AuditEntry[];
  promoCodes: AdminPromoCode[];
  canManageAccounts?: boolean;
}) {
  const [tab, setTab] = React.useState<Tab>("users");
  const [q, setQ] = React.useState("");

  const filtered = users.filter((u) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (u.email ?? "").toLowerCase().includes(s) ||
      (u.fullName ?? "").toLowerCase().includes(s) ||
      (u.username ?? "").toLowerCase().includes(s) ||
      (u.promoCode ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard icon={UsersIcon} label="Total users" value={summary.total} />
        <SummaryCard icon={CircleSlashIcon} label="Free users" value={summary.free} />
        <SummaryCard icon={BadgeDollarSignIcon} label="Pro subscribers" value={summary.pro} />
        <SummaryCard icon={CrownIcon} label="Premium subscribers" value={summary.premium} />
        <SummaryCard icon={TicketPercentIcon} label="Promo users" value={summary.promo} />
        <SummaryCard icon={InfinityIcon} label="Lifetime users" value={summary.lifetime} />
        <SummaryCard icon={CreditCardIcon} label="Active subscriptions" value={summary.activeSubscriptions} />
        <SummaryCard icon={GiftIcon} label="Expired subscriptions" value={summary.expiredSubscriptions} />
      </div>

      <div className="flex w-fit flex-wrap items-center gap-1 rounded-full bg-secondary p-1 text-sm">
        {(["users", "promos", "invitations", "feedback", "audit"] as const).map((t) => (
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
            {t}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, username, email, or promo"
              className="max-w-xs"
            />
            {canManageAccounts && <CreateComplimentary />}
          </div>
          <UsersTable users={filtered} canManage={canManageAccounts} />
        </div>
      )}
      {tab === "promos" && (
        <PromoCodesPanel promoCodes={promoCodes} canManage={canManageAccounts} />
      )}
      {tab === "invitations" && (
        <InvitationsPanel invitations={invitations} canManage={canManageAccounts} />
      )}
      {tab === "feedback" && <FeedbackTriage feedback={feedback} users={users} />}
      {tab === "audit" && <AuditPanel entries={auditLog} />}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
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
  if (u.role === "super_admin") {
    return {
      label: u.roleSource === "bootstrap" ? "Super Admin · auto" : "Super Admin",
      className: "bg-brand text-brand-foreground",
    };
  }
  const paid = u.plan !== "free";
  const tier = u.plan === "premium" ? "Premium" : "Pro";
  if (u.accessType === "lifetime_pro" && paid)
    return { label: `Lifetime ${tier}`, className: "bg-brand/10 text-brand" };
  if (u.accessType === "complimentary_pro" && paid)
    return { label: `Complimentary ${tier}`, className: "bg-brand-2/15 text-brand-2" };
  if (u.accessType === "promo" && paid)
    return { label: `Promo ${tier}`, className: "bg-warning/15 text-warning" };
  if (u.plan === "premium")
    return { label: "Premium", className: "bg-brand text-brand-foreground" };
  if (u.plan === "pro")
    return { label: "Pro", className: "bg-success/15 text-success" };
  return { label: "Free", className: "bg-secondary text-muted-foreground" };
}

function UsersTable({ users, canManage = true }: { users: AdminUser[]; canManage?: boolean }) {
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
            <th className="px-3 py-2 font-medium">Started</th>
            <th className="px-3 py-2 font-medium">Expires / renews</th>
            <th className="px-3 py-2 font-medium">Billing</th>
            <th className="px-3 py-2 font-medium">Paid</th>
            <th className="px-3 py-2 font-medium">Promo</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow key={u.userId} u={u} canManage={canManage} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ u, canManage = true }: { u: AdminUser; canManage?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const badge = planBadge(u);

  async function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Something went wrong.");
    toast.success(res.message ?? "Done.", { duration: 8000 });
    router.refresh();
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2">
        <p className="font-medium">{u.fullName ?? u.username ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{u.email}</p>
        {u.username && <p className="text-[11px] text-muted-foreground">@{u.username}</p>}
      </td>
      <td className="px-3 py-2">
        <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", badge.className)}>
          {badge.label}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        <span className={u.status === "active" ? "" : "text-error"}>{u.status}</span>
        {u.subStatus && <span className="block">sub: {u.subStatus}</span>}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{adminDate(u.periodStart)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {adminDate(u.renewalOrExpiry)}
        {u.cancelAtPeriodEnd && (
          <span className="ml-1.5 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
            no auto-renew
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{u.billingPeriod ?? u.interval ?? "—"}</td>
      <td className="tnum px-3 py-2 text-xs text-muted-foreground">{peso(u.amountPaid)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{u.promoCode ?? "—"}</td>
      <td className="px-3 py-2 text-right">
        {u.role === "super_admin" || !canManage ? (
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
                {busy ? <Loader2Icon className="size-4 animate-spin" /> : <MoreVerticalIcon className="size-4" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => run(() => grantTimedAccess({ userId: u.userId, plan: "pro", months: 1 }))}>
                Grant Pro · 1 month
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => run(() => grantTimedAccess({ userId: u.userId, plan: "premium", months: 3 }))}>
                Grant Premium · 3 months
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => run(() => setAccess(u.userId, "lifetime_pro", null, "premium"))}>
                Grant Lifetime Premium
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => run(() => extendUserAccess(u.userId, 1))}>
                Extend current plan · 1 month
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => run(() => extendUserAccess(u.userId, 3))}>
                Extend current plan · 3 months
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => run(() => cancelUserSubscription(u.userId), "Cancel this user's access and move them to Free?")}
              >
                Cancel / downgrade to Free
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => run(() => resetPassword(u.userId), "Reset this user's password? A temporary one will be shown.")}
              >
                Reset password
              </DropdownMenuItem>
              {u.status === "active" ? (
                <DropdownMenuItem onClick={() => run(() => setAccountStatus(u.userId, "suspended"), "Suspend this account?")}>Suspend account</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => run(() => setAccountStatus(u.userId, "active"))}>Reactivate account</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => run(() => setAccountStatus(u.userId, "revoked"), "Revoke access entirely?")}>Revoke access</DropdownMenuItem>
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
  const [plan, setPlan] = React.useState<"pro" | "premium">("premium");
  const [accessType, setAccessType] = React.useState<Exclude<AccessType, "paid">>("complimentary_pro");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <FormSheet title="Create complimentary account" trigger={<Button variant="outline"><UserPlusIcon className="size-4" /> New account</Button>}>
      {(close) => (
        <div className="space-y-3">
          <Field label="Full name"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
          <Field label="Username (unique)"><Input value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Plan">
            <select value={plan} onChange={(e) => setPlan(e.target.value as "pro" | "premium")} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
          </Field>
          <Field label="Access type">
            <select value={accessType} onChange={(e) => setAccessType(e.target.value as Exclude<AccessType, "paid">)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
              <option value="complimentary_pro">Temporary complimentary</option>
              <option value="lifetime_pro">Lifetime</option>
            </select>
          </Field>
          {accessType === "complimentary_pro" && (
            <Field label="Expiration (optional)"><Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></Field>
          )}
          <Button
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await createComplimentaryAccount({ email, fullName, username, accessType, plan, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null });
              setBusy(false);
              if (!res.ok) return toast.error(res.error);
              toast.success(res.message ?? "Created.", { duration: 12000 });
              router.refresh();
              close();
            }}
          >
            {busy && <Loader2Icon className="size-4 animate-spin" />} Create account
          </Button>
        </div>
      )}
    </FormSheet>
  );
}

function PromoCodesPanel({ promoCodes, canManage }: { promoCodes: AdminPromoCode[]; canManage: boolean }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [plan, setPlan] = React.useState<"pro" | "premium">("premium");
  const [duration, setDuration] = React.useState("3");
  const [max, setMax] = React.useState("");
  const [expires, setExpires] = React.useState("");
  const [price, setPrice] = React.useState("0");
  const [active, setActive] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function create() {
    setBusy(true);
    const res = await createPromoCode({
      code,
      plan,
      durationMonths: Number(duration),
      maxRedemptions: max ? Number(max) : null,
      expiresAt: expires ? new Date(expires).toISOString() : null,
      active,
      specialPrice: price === "" ? 0 : Number(price),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(res.message ?? "Promo created.");
    setCode("");
    setMax("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <Card className="shadow-soft">
          <CardContent className="space-y-3 pt-5">
            <div>
              <p className="text-sm font-medium">Create promo code</p>
              <p className="text-xs text-muted-foreground">Use ₱0 for 100% free access. Paid promo codes create one-off invoices and never auto-renew.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Field label="Code"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME" /></Field>
              <Field label="Plan">
                <select value={plan} onChange={(e) => setPlan(e.target.value as "pro" | "premium")} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
                  <option value="pro">Pro</option>
                  <option value="premium">Premium</option>
                </select>
              </Field>
              <Field label="Duration months"><Input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
              <Field label="Special price"><Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" /></Field>
              <Field label="Max redemptions"><Input type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Unlimited" /></Field>
              <Field label="Expires"><Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field>
              <label className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
              </label>
              <Button className="mt-5" disabled={busy} onClick={create}>
                {busy && <Loader2Icon className="size-4 animate-spin" />} Create promo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Duration</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Usage</th>
              <th className="px-3 py-2 font-medium">Expires</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {promoCodes.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">No promo codes yet.</td></tr>
            ) : promoCodes.map((promo) => (
              <tr key={promo.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-mono text-xs font-medium">{promo.code}</td>
                <td className="px-3 py-2 capitalize">{promo.plan}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{promo.duration_months} months</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{peso(promo.special_price ?? 0)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {promo.totalRedemptions}{promo.max_redemptions ? ` / ${promo.max_redemptions}` : ""}
                  <span className="block">{promo.activeRedemptions} active · {promo.pendingRedemptions} pending</span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{adminDate(promo.expires_at)}</td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", promo.active ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground")}>{promo.active ? "Active" : "Paused"}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === promo.id}
                      onClick={async () => {
                        setBusyId(promo.id);
                        const res = await setPromoCodeActive(promo.id, !promo.active);
                        setBusyId(null);
                        if (!res.ok) return toast.error(res.error);
                        toast.success(res.message ?? "Updated.");
                        router.refresh();
                      }}
                    >
                      {busyId === promo.id && <Loader2Icon className="size-4 animate-spin" />}
                      {promo.active ? "Pause" : "Activate"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

function FeedbackTriage({ feedback, users }: { feedback: Feedback[]; users: AdminUser[] }) {
  const emailById = new Map(users.map((u) => [u.userId, u.email]));
  const [showArchived, setShowArchived] = React.useState(false);
  const visible = feedback.filter((f) => showArchived || !f.archived);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">No feedback yet.</p>
      ) : (
        visible.map((f) => <FeedbackItem key={f.id} f={f} email={emailById.get(f.user_id) ?? null} />)
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
    if (!res.ok) return toast.error(res.error);
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
              {CATEGORY_LABELS[f.category]} · {email ?? "unknown"} · {new Date(f.created_at).toLocaleDateString()}{f.is_duplicate ? " · duplicate" : ""}
            </p>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{f.message}</p>
        {f.screenshot_url && <a href={f.screenshot_url} target="_blank" rel="noreferrer" className="text-xs text-brand-2 underline">View screenshot</a>}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)} className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm">
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
        </div>
        <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Response to the user (visible to them)" rows={2} />
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note (never shown to the user)" rows={2} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => save()}>{busy && <Loader2Icon className="size-4 animate-spin" />} Save</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => save({ isDuplicate: !f.is_duplicate })}>{f.is_duplicate ? "Unmark duplicate" : "Mark duplicate"}</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => save({ archived: !f.archived })}>{f.archived ? "Unarchive" : "Archive"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}