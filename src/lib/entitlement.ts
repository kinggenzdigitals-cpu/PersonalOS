import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/plans";
import type {
  AccessType,
  AccountStatus,
  Subscription,
  UserRole,
} from "@/lib/supabase/types";

export type Entitlement = {
  userId: string | null;
  email: string | null;
  role: UserRole;
  plan: PlanId;
  accountStatus: AccountStatus;
  accessType: AccessType | null;
  isSuperAdmin: boolean;
};

/** Platform owner email(s) — always Super Admin, in addition to the DB role. */
const OWNER_EMAILS = ["kingfmgonzales@gmail.com"];

const ANON: Entitlement = {
  userId: null,
  email: null,
  role: "user",
  plan: "free",
  accountStatus: "active",
  accessType: null,
  isSuperAdmin: false,
};

/**
 * The single source of truth for what a user is entitled to, decided entirely
 * server-side:
 *   super_admin       → unlimited Pro, never billed, never expires
 *   lifetime_pro      → Pro without billing
 *   complimentary_pro → Pro until access_expires_at (or forever if null)
 *   paid_subscriber   → Pro while the paid period is active
 *   free / expired    → Free
 * Suspended or revoked accounts get Free regardless.
 */
export async function getEntitlement(): Promise<Entitlement> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return ANON;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("user_id", user.id)
    .maybeSingle<{ role: UserRole; status: AccountStatus }>();

  const role: UserRole = profile?.role ?? "user";
  const accountStatus: AccountStatus = profile?.status ?? "active";

  // Owner accounts are always super admin — no DB role or env var required,
  // so the platform owner can never be locked out of the admin dashboard.
  const email = user.email?.toLowerCase();
  const bootstrapEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase();
  const isSuperAdmin =
    role === "super_admin" ||
    (!!bootstrapEmail && email === bootstrapEmail) ||
    (!!email && OWNER_EMAILS.includes(email));

  if (isSuperAdmin) {
    return {
      userId: user.id,
      email: user.email ?? null,
      role: "super_admin",
      plan: "pro",
      accountStatus: "active",
      accessType: "lifetime_pro",
      isSuperAdmin: true,
    };
  }

  if (accountStatus !== "active") {
    return {
      userId: user.id,
      email: user.email ?? null,
      role,
      plan: "free",
      accountStatus,
      accessType: null,
      isSuperAdmin: false,
    };
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select(
      "plan, status, access_type, access_expires_at, current_period_end",
    )
    .eq("user_id", user.id)
    .maybeSingle<
      Pick<
        Subscription,
        | "plan"
        | "status"
        | "access_type"
        | "access_expires_at"
        | "current_period_end"
      >
    >();

  const now = Date.now();
  const notExpired = (iso: string | null | undefined) =>
    !iso || new Date(iso).getTime() > now;

  let plan: PlanId = "free";
  const accessType = sub?.access_type ?? null;
  if (sub) {
    if (accessType === "lifetime_pro") {
      plan = "pro";
    } else if (accessType === "complimentary_pro") {
      plan = notExpired(sub.access_expires_at) ? "pro" : "free";
    } else if (sub.plan === "pro" && sub.status === "active") {
      plan = notExpired(sub.current_period_end) ? "pro" : "free";
    }
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
    plan,
    accountStatus,
    accessType,
    isSuperAdmin: false,
  };
}

export async function isSuperAdmin(): Promise<boolean> {
  return (await getEntitlement()).isSuperAdmin;
}

/** Redirects non-admins away from Super Admin pages. */
export async function requireSuperAdmin(): Promise<Entitlement> {
  const ent = await getEntitlement();
  if (!ent.isSuperAdmin) redirect("/home");
  return ent;
}
