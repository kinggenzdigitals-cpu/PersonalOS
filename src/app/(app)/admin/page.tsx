import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/entitlement";
import { listAdminUsers, summarize } from "@/lib/admin/users";
import { listAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import type { Feedback, Invitation } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Subscribers & Users" };

export default async function AdminPage() {
  const me = await requireSuperAdmin();
  const users = await listAdminUsers();
  const summary = summarize(users);
  // A provisional (allow-list) grant is read + triage only; the server enforces
  // this regardless, but hiding the controls avoids inviting a failed action.
  const canManageAccounts = me.adminTier !== "provisional";

  const admin = createAdminClient();
  const [feedbackRes, invitesRes, auditLog] = await Promise.all([
    admin
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("user_invitations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    listAuditLog(
      200,
      new Map(
        users
          .filter((u): u is typeof u & { email: string } => Boolean(u.email))
          .map((u) => [u.userId, u.email]),
      ),
    ),
  ]);
  const feedback = feedbackRes.data;
  const invitations = (invitesRes.data as Invitation[] | null) ?? [];

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl tracking-tight">
          Subscribers &amp; Users
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage accounts, complimentary access, and feedback.
        </p>
        {!canManageAccounts && (
          <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-foreground">
            <span className="font-medium">View-only admin access.</span> Your
            role was granted automatically from the email allow-list, so account
            actions and invitations are disabled. Ask the platform owner to make
            the grant permanent.
          </p>
        )}
      </header>
      <AdminDashboard
        users={users}
        summary={summary}
        feedback={(feedback as Feedback[] | null) ?? []}
        invitations={invitations}
        auditLog={auditLog}
        canManageAccounts={canManageAccounts}
      />
    </div>
  );
}
