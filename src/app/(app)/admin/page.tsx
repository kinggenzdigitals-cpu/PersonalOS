import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/entitlement";
import { listAdminUsers, summarize } from "@/lib/admin/users";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import type { Feedback, Invitation } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Subscribers & Users" };

export default async function AdminPage() {
  await requireSuperAdmin();
  const users = await listAdminUsers();
  const summary = summarize(users);

  const admin = createAdminClient();
  const [feedbackRes, invitesRes] = await Promise.all([
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
      </header>
      <AdminDashboard
        users={users}
        summary={summary}
        feedback={(feedback as Feedback[] | null) ?? []}
        invitations={invitations}
      />
    </div>
  );
}
