import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminAuditLog } from "@/lib/supabase/types";

/** An audit entry with the admin/target resolved to something human-readable. */
export type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  adminId: string;
  adminLabel: string;
  targetUserId: string | null;
  targetLabel: string | null;
  detail: Record<string, unknown> | null;
};

/**
 * The Super Admin audit trail. Every privileged action already writes here
 * (grant/revoke access, suspend, reset password, invitations); this reads it
 * back so the log is actually reviewable rather than write-only.
 *
 * Service-role read: the RLS policy gates on is_super_admin(), and the caller
 * is already behind requireSuperAdmin().
 */
export async function listAuditLog(
  limit = 200,
  /**
   * userId → email, if the caller already has it. The admin page loads every
   * user anyway, so passing it in avoids a second 1000-row auth listing per
   * page render.
   */
  knownEmails?: Map<string, string>,
): Promise<AuditEntry[]> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const { data, error } = await admin
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AdminAuditLog[]>();

  // Table missing (migration 0008 not applied) → show an empty trail.
  if (error || !data) return [];

  // Resolve the user ids involved to emails in one call.
  const ids = new Set<string>();
  for (const row of data) {
    if (row.admin_id) ids.add(row.admin_id);
    if (row.target_user_id) ids.add(row.target_user_id);
  }

  const emails = new Map<string, string>(knownEmails ?? []);
  const unresolved = [...ids].filter((id) => !emails.has(id));
  if (unresolved.length > 0) {
    const { data: authData } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const u of authData?.users ?? []) {
      if (u.email) emails.set(u.id, u.email);
    }
  }

  const short = (id: string) => `${id.slice(0, 8)}…`;

  return data.map((row) => ({
    id: row.id,
    action: row.action,
    createdAt: row.created_at,
    adminId: row.admin_id,
    adminLabel: emails.get(row.admin_id) ?? short(row.admin_id),
    targetUserId: row.target_user_id,
    targetLabel: row.target_user_id
      ? (emails.get(row.target_user_id) ?? short(row.target_user_id))
      : null,
    detail:
      row.detail && Object.keys(row.detail).length > 0 ? row.detail : null,
  }));
}
