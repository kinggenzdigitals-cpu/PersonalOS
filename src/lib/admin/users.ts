import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanId } from "@/lib/plans";
import type {
  AccessType,
  AccountStatus,
  UserRole,
} from "@/lib/supabase/types";

type PlanValue = PlanId;

export type AdminUser = {
  userId: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  role: UserRole;
  status: AccountStatus;
  accessType: AccessType | null;
  plan: PlanValue;
  subStatus: string | null;
  interval: string | null;
  periodStart: string | null;
  renewalOrExpiry: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
  last_login_at: string | null;
};

type SubRow = {
  user_id: string;
  plan: string;
  status: string;
  interval: string | null;
  access_type: AccessType | null;
  access_expires_at: string | null;
  current_period_end: string | null;
  created_at: string;
};

function effectivePlan(
  role: UserRole,
  status: AccountStatus,
  sub: SubRow | undefined,
  now: number,
): PlanValue {
  if (status !== "active" && role !== "super_admin") return "free";
  if (role === "super_admin") return "pro";
  const at = sub?.access_type ?? null;
  const live = (iso: string | null | undefined) =>
    !iso || new Date(iso).getTime() > now;
  if (at === "lifetime_pro") return "pro";
  if (at === "complimentary_pro") return live(sub?.access_expires_at) ? "pro" : "free";
  if (sub?.plan === "pro" && sub?.status === "active")
    return live(sub?.current_period_end) ? "pro" : "free";
  return "free";
}

/** Every registered user with their account + subscription info (admin only). */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const admin = createAdminClient();
  const [authRes, profRes, subRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("profiles")
      .select(
        "user_id, display_name, username, role, status, created_at, last_login_at",
      ),
    admin
      .from("subscriptions")
      .select(
        "user_id, plan, status, interval, access_type, access_expires_at, current_period_end, created_at",
      ),
  ]);

  const profiles = (profRes.data as ProfileRow[] | null) ?? [];
  const subs = (subRes.data as SubRow[] | null) ?? [];
  const profMap = new Map(profiles.map((p) => [p.user_id, p]));
  const subMap = new Map(subs.map((s) => [s.user_id, s]));
  const now = Date.now();

  return (authRes.data?.users ?? []).map((u) => {
    const p = profMap.get(u.id);
    const s = subMap.get(u.id);
    const role: UserRole = p?.role ?? "user";
    const status: AccountStatus = p?.status ?? "active";
    return {
      userId: u.id,
      email: u.email ?? null,
      fullName: p?.display_name ?? null,
      username: p?.username ?? null,
      role,
      status,
      accessType: s?.access_type ?? null,
      plan: effectivePlan(role, status, s, now),
      subStatus: s?.status ?? null,
      interval: s?.interval ?? null,
      periodStart: s?.created_at ?? null,
      renewalOrExpiry: s?.access_expires_at ?? s?.current_period_end ?? null,
      lastLoginAt: u.last_sign_in_at ?? p?.last_login_at ?? null,
      createdAt: u.created_at ?? p?.created_at ?? null,
    };
  });
}

export type AdminSummary = {
  total: number;
  activePaid: number;
  complimentary: number;
  lifetime: number;
  expiredCancelled: number;
};

export function summarize(users: AdminUser[]): AdminSummary {
  let activePaid = 0;
  let complimentary = 0;
  let lifetime = 0;
  let expiredCancelled = 0;
  for (const u of users) {
    if (u.accessType === "lifetime_pro") lifetime++;
    else if (u.accessType === "complimentary_pro" && u.plan === "pro")
      complimentary++;
    else if (u.plan === "pro" && u.accessType === "paid") activePaid++;
    else if (u.plan === "pro" && u.accessType == null && u.subStatus === "active")
      activePaid++;
    if (
      (u.subStatus === "canceled" || u.subStatus === "past_due") &&
      u.plan === "free"
    )
      expiredCancelled++;
  }
  return {
    total: users.length,
    activePaid,
    complimentary,
    lifetime,
    expiredCancelled,
  };
}
