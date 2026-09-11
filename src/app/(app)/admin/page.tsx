import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/entitlement";
import { listAdminPromoCodes, listAdminUsers, summarize } from "@/lib/admin/users";
import { listAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import type { Feedback, Invitation } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Subscribers & Users" };

export default async function AdminPage() {
  const me = await requireSuperAdmin();
  // A provisional (allow-list) grant is read + triage only; the server enforces
  // this regardless, but hiding the controls avoids inviting a failed action.
  const canManageAccounts = me.adminTier !== "provisional";

  // Keeps main's resilience: a missing service-role key or an unapplied
  // migration renders an explanatory card instead of crashing the page.
  let data:
    | {
        users: Awaited<ReturnType<typeof listAdminUsers>>;
        feedback: Feedback[];
        invitations: Invitation[];
        auditLog: Awaited<ReturnType<typeof listAuditLog>>;
        promoCodes: Awaited<ReturnType<typeof listAdminPromoCodes>>;
      }
    | null = null;

  try {
    const users = await listAdminUsers();
    const admin = createAdminClient();
    const [feedbackRes, invitesRes, auditLog, promoCodes] = await Promise.all([
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
      // Reuse the emails already fetched above rather than paging auth.users
      // a second time for the same render.
      listAuditLog(
        200,
        new Map(
          users
            .filter((u): u is typeof u & { email: string } => Boolean(u.email))
            .map((u) => [u.userId, u.email]),
        ),
      ),
      listAdminPromoCodes(),
    ]);
    if (feedbackRes.error || invitesRes.error) {
      throw new Error("Unable to load admin dashboard data.");
    }
    data = {
      users,
      feedback: (feedbackRes.data as Feedback[] | null) ?? [],
      invitations: (invitesRes.data as Invitation[] | null) ?? [],
      auditLog,
      promoCodes,
    };
  } catch {
    data = null;
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl tracking-tight">
          Subscribers &amp; Users
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage users, subscription access, promo codes, invitations, and feedback.
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
      {data ? (
        <AdminDashboard
          users={data.users}
          summary={summarize(data.users)}
          feedback={data.feedback}
          invitations={data.invitations}
          auditLog={data.auditLog}
          promoCodes={data.promoCodes}
          canManageAccounts={canManageAccounts}
        />
      ) : (
        <Card className="border-error/30 bg-error/5 shadow-card">
          <CardContent className="space-y-1 pt-6">
            <p className="font-medium">Admin data is temporarily unavailable.</p>
            <p className="text-sm text-muted-foreground">
              Check the secure Supabase service-role key and confirm that the latest database migrations are applied.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
