import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanId } from "@/lib/plans";
import type {
  AccountStatus,
  PromoCode,
  RoleSource,
  SubscriptionAccessType,
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
  accessType: SubscriptionAccessType | null;
  plan: PlanValue;
  subStatus: string | null;
  interval: string | null;
  billingPeriod: string | null;
  amountPaid: number | null;
  promoCode: string | null;
  periodStart: string | null;
  renewalOrExpiry: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  cancelAtPeriodEnd: boolean;
  roleSource: RoleSource | null;
};

export type AdminPromoCode = PromoCode & {
  totalRedemptions: number;
  activeRedemptions: number;
  pendingRedemptions: number;
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
  billing_period?: string | null;
  amount_paid?: number | null;
  promo_code?: string | null;
  access_type: SubscriptionAccessType | null;
  access_expires_at: string | null;
  current_period_start?: string | null;
  current_period_end: string | null;
  created_at: string;
  cancel_at_period_end?: boolean | null;
};

function live(iso: string | null | undefined, now: number) {
  return !iso || new Date(iso).getTime() > now;
}

function periodLive(iso: string | null | undefined, now: number) {
  return !!iso && new Date(iso).getTime() > now;
}

function effectivePlan(
  role: UserRole,
  status: AccountStatus,
  sub: SubRow | undefined,
  now: number,
): PlanValue {
  if (status !== "active") return "free";
  if (role === "super_admin") return "premium";
  const at = sub?.access_type ?? null;
  const paidTier: PlanValue = sub?.plan === "premium" ? "premium" : "pro";
  if (at === "lifetime_pro") return paidTier;
  if (at === "complimentary_pro") return live(sub?.access_expires_at, now) ? paidTier : "free";
  if (at === "promo") return periodLive(sub?.access_expires_at ?? sub?.current_period_end, now) ? paidTier : "free";
  if (
    (sub?.plan === "pro" || sub?.plan === "premium") &&
    sub?.status === "active"
  ) {
    return periodLive(sub?.current_period_end, now) ? paidTier : "free";
  }
  return "free";
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const admin = createAdminClient();
  const [authRes, profRes, subRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("*"),
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
      billingPeriod: s?.billing_period ?? s?.interval ?? null,
      amountPaid: s?.amount_paid ?? null,
      promoCode: s?.promo_code ?? null,
      periodStart: s?.current_period_start ?? s?.created_at ?? null,
      renewalOrExpiry: s?.access_expires_at ?? s?.current_period_end ?? null,
      lastLoginAt: u.last_sign_in_at ?? p?.last_login_at ?? null,
      createdAt: u.created_at ?? p?.created_at ?? null,
      cancelAtPeriodEnd: s?.cancel_at_period_end === true,
      roleSource: p?.role_source ?? null,
    };
  });
}

export async function listAdminPromoCodes(): Promise<AdminPromoCode[]> {
  const admin = createAdminClient();
  const [codeRes, redemptionRes] = await Promise.all([
    admin.from("promo_codes").select("*").order("created_at", { ascending: false }),
    admin.from("promo_redemptions").select("promo_code_id, status"),
  ]);
  if (codeRes.error) throw new Error("Unable to load promo codes.");
  if (redemptionRes.error) throw new Error("Unable to load promo redemptions.");

  const counts = new Map<string, { total: number; active: number; pending: number }>();
  for (const r of (redemptionRes.data as { promo_code_id: string; status: string }[] | null) ?? []) {
    const row = counts.get(r.promo_code_id) ?? { total: 0, active: 0, pending: 0 };
    row.total += 1;
    if (r.status === "active") row.active += 1;
    if (r.status === "pending") row.pending += 1;
    counts.set(r.promo_code_id, row);
  }

  return ((codeRes.data as PromoCode[] | null) ?? []).map((code) => {
    const c = counts.get(code.id) ?? { total: 0, active: 0, pending: 0 };
    return {
      ...code,
      totalRedemptions: c.total,
      activeRedemptions: c.active,
      pendingRedemptions: c.pending,
    };
  });
}

export type AdminSummary = {
  total: number;
  free: number;
  pro: number;
  premium: number;
  promo: number;
  lifetime: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
};

export function summarize(users: AdminUser[]): AdminSummary {
  let free = 0;
  let pro = 0;
  let premium = 0;
  let promo = 0;
  let lifetime = 0;
  let activeSubscriptions = 0;
  let expiredSubscriptions = 0;

  for (const u of users) {
    if (u.plan === "free") {
      free += 1;
      if (
        u.accessType != null ||
        u.subStatus === "canceled" ||
        u.subStatus === "past_due" ||
        (u.renewalOrExpiry && new Date(u.renewalOrExpiry).getTime() <= Date.now())
      ) {
        expiredSubscriptions += 1;
      }
      continue;
    }

    activeSubscriptions += 1;
    if (u.plan === "premium") premium += 1;
    else if (u.plan === "pro") pro += 1;
    if (u.accessType === "promo") promo += 1;
    if (u.accessType === "lifetime_pro") lifetime += 1;
  }

  return {
    total: users.length,
    free,
    pro,
    premium,
    promo,
    lifetime,
    activeSubscriptions,
    expiredSubscriptions,
  };
}