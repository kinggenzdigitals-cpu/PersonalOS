import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/entitlement";
import { listAdminUsers, summarize } from "@/lib/admin/users";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import type { Feedback, Invitation } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Subscribers & Users" };

export default async function AdminPage() {
  await requireSuperAdmin();
  let data:
    | {
        users: Awaited<ReturnType<typeof listAdminUsers>>;
        feedback: Feedback[];
        invitations: Invitation[];
      }
    | null = null;

  try {
    const users = await listAdminUsers();
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
    if (feedbackRes.error || invitesRes.error) {
      throw new Error("Unable to load admin dashboard data.");
    }
    data = {
      users,
      feedback: (feedbackRes.data as Feedback[] | null) ?? [],
      invitations: (invitesRes.data as Invitation[] | null) ?? [],
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
          Manage accounts, complimentary access, and feedback.
        </p>
      </header>
      {data ? (
        <AdminDashboard
          users={data.users}
          summary={summarize(data.users)}
          feedback={data.feedback}
          invitations={data.invitations}
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
