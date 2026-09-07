import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanId } from "@/lib/plans";
import type {
  AccessType,
  AccountStatus,
  RoleSource,
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
  cancelAtPeriodEnd: boolean;
  /** How a super_admin role was granted — "bootstrap" grants self-revoke. */
  roleSource: RoleSource | null;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
  last_login_at: string | null;
  role_source?: RoleSource | null;
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
  cancel_at_period_end?: boolean | null;
};

/**
 * Mirrors src/lib/entitlement.ts. Premium must be handled explicitly — treating
 * only "pro" as paid used to report every Premium subscriber as Free.
 */
function effectivePlan(
  role: UserRole,
  status: AccountStatus,
  sub: SubRow | undefined,
  now: number,
): PlanValue {
  // Status is checked first, for everyone: a suspended super admin is not
  // entitled to anything (mirrors the same ordering in entitlement.ts).
  if (status !== "active") return "free";
  if (role === "super_admin") return "premium";
  const at = sub?.access_type ?? null;
  // Null = "no end date", valid only for a granted access_type.
  const live = (iso: string | null | undefined) =>
    !iso || new Date(iso).getTime() > now;
  // A PAID period must have a real end date. main's version used live(), which
  // treats null as "never expires" — so a row left at plan=pro/status=active
  // with no period (exactly what admin "Remove Pro access" used to leave)
  // granted the tier forever. Keeping the stricter check.
  const periodLive = (iso: string | null | undefined) =>
    !!iso && new Date(iso).getTime() > now;
  const paidTier: PlanValue = sub?.plan === "premium" ? "premium" : "pro";
  if (at === "lifetime_pro") return paidTier;
  if (at === "complimentary_pro")
    return live(sub?.access_expires_at) ? paidTier : "free";
  if (
    (sub?.plan === "pro" || sub?.plan === "premium") &&
    sub?.status === "active"
  ) {
    return periodLive(sub?.current_period_end) ? paidTier : "free";
  }
  return "free";
}

/** Every registered user with their account + subscription info (admin only). */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const admin = createAdminClient();
  const [authRes, profRes, subRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    // `*` so a not-yet-applied migration (e.g. 0018's role_source) can't turn
    // this into an unknown-column error.
    admin.from("profiles").select("*"),
    // `*` rather than an explicit list so a not-yet-applied migration (e.g.
    // 0017's cancel_at_period_end) can't turn this into an unknown-column error.
    admin.from("subscriptions").select("*"),
  ]);

  const error = authRes.error ?? profRes.error ?? subRes.error;
  if (error) throw new Error("Unable to load admin user data.");

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
      cancelAtPeriodEnd: s?.cancel_at_period_end === true,
      roleSource: p?.role_source ?? null,
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
    // Bucket on EFFECTIVE access (`plan !== "free"` covers Pro and Premium),
    // so a suspended lifetime user isn't counted as an active lifetime one.
    const paid = u.plan !== "free";
    if (paid) {
      if (u.accessType === "lifetime_pro") lifetime++;
      else if (u.accessType === "complimentary_pro") complimentary++;
      else activePaid++;
    } else if (
      // Had something, has nothing now: lapsed payer, expired comp grant, or
      // an admin-revoked account (revoke writes status 'canceled').
      u.accessType != null ||
      u.subStatus === "canceled" ||
      u.subStatus === "past_due"
    ) {
      expiredCancelled++;
    }
  }
  return {
    total: users.length,
    activePaid,
    complimentary,
    lifetime,
    expiredCancelled,
  };
}
