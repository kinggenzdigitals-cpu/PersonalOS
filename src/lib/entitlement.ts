import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ensureSuperAdminRole,
  revokeBootstrapSuperAdmin,
} from "@/lib/admin/bootstrap";
import type { PlanId } from "@/lib/plans";
import type {
  AccessType,
  AccountStatus,
  RoleSource,
  Subscription,
  UserRole,
} from "@/lib/supabase/types";

/**
 * How much of the admin toolset a super admin may reach.
 *
 *  "owner"       — the platform owner (in-source allow-list). Full access, and
 *                  never revocable; the deployment must always have one.
 *  "permanent"   — role granted deliberately in the database ('manual'). Full
 *                  access.
 *  "provisional" — auto-granted from the SUPER_ADMIN_EMAILS allow-list
 *                  ('bootstrap'), and withdrawn again when that address is
 *                  removed. READ AND TRIAGE ONLY.
 *
 * The split exists because a provisional grant is meant to be withdrawable. If
 * it carried the full toolset, its holder could mint credentials for a
 * permanent account and outlive their own revocation — so removing them from
 * the allow-list would revoke nothing.
 */
export type AdminTier = "owner" | "permanent" | "provisional";

export type Entitlement = {
  userId: string | null;
  email: string | null;
  role: UserRole;
  plan: PlanId;
  accountStatus: AccountStatus;
  accessType: AccessType | null;
  isSuperAdmin: boolean;
  /** null when the account isn't an admin at all. */
  adminTier: AdminTier | null;
};

/**
 * Platform owner email(s) — always Super Admin, in addition to the DB role.
 * Kept in source as a last-resort fallback so the owner can never be locked out
 * of their own deployment, and always merged with (never replaced by) the env
 * allow-list.
 */
const FALLBACK_OWNER_EMAILS = ["kingfmgonzales@gmail.com"];

/**
 * Owner emails from env (`SUPER_ADMIN_EMAILS` comma-separated, or the older
 * singular `SUPER_ADMIN_EMAIL`) merged with the in-source fallback.
 */
/** True if this address is on the owner allow-list (case-insensitive). */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmails().includes(email.toLowerCase());
}

/**
 * True only for the in-source platform owner — NOT for addresses added via
 * SUPER_ADMIN_EMAILS. The owner keeps the full toolset even on a brand-new
 * database where their own grant is still tagged 'bootstrap'; without this,
 * gating on the tag alone would lock the owner out of their own deployment.
 */
function isPlatformOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return FALLBACK_OWNER_EMAILS.includes(email.toLowerCase());
}

/**
 * The message to return when a provisional admin attempts a privileged action,
 * or null when they may proceed. Callers already hold the Entitlement from
 * requireSuperAdmin(), so this is a pure check.
 */
export function provisionalAdminBlock(ent: Entitlement): string | null {
  if (ent.adminTier !== "provisional") return null;
  return "Your admin access was granted automatically from the email allow-list, so it's limited to viewing and feedback triage. Ask the platform owner to grant it permanently.";
}

function ownerEmails(): string[] {
  const raw = [
    process.env.SUPER_ADMIN_EMAILS,
    process.env.SUPER_ADMIN_EMAIL,
  ]
    .filter(Boolean)
    .join(",");
  const fromEnv = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...fromEnv, ...FALLBACK_OWNER_EMAILS])];
}

const ANON: Entitlement = {
  userId: null,
  email: null,
  role: "user",
  plan: "free",
  accountStatus: "active",
  accessType: null,
  isSuperAdmin: false,
  adminTier: null,
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

  // `select("*")` so naming role_source can't fail the read before migration
  // 0018 is applied.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<{
      role: UserRole;
      status: AccountStatus;
      role_source?: RoleSource | null;
    }>();

  let role: UserRole = profile?.role ?? "user";
  const accountStatus: AccountStatus = profile?.status ?? "active";
  const roleSource = profile?.role_source ?? null;

  // Owner accounts are always super admin — no DB role required, so the
  // platform owner can never be locked out of their own deployment.
  //
  // The address MUST be confirmed. Without that check, a project with email
  // confirmations disabled would hand super admin to anyone who signs up as (or
  // switches their address to) an unregistered allow-list address — and the
  // promotion below would make it permanent.
  const email = user.email?.toLowerCase();
  const emailVerified = Boolean(user.email_confirmed_at);
  const byEmail =
    emailVerified && !!email && ownerEmails().includes(email);

  // Keep the database in step with the app: `is_super_admin()` — which every
  // admin RLS policy gates on — only reads profiles.role, so an owner granted
  // by email alone would be denied at the RLS layer.
  //
  // Also runs when the account IS already an admin but carries no grant tag, so
  // a promotion made before migration 0018 gets labelled 'bootstrap' and
  // becomes revocable. Both cases are one-shot: once tagged, neither fires.
  if (byEmail && role !== "super_admin") {
    await ensureSuperAdminRole(user.id);
  }

  // …and withdraw it again when the address leaves the allow-list. Only grants
  // tagged 'bootstrap' are withdrawn; a role granted deliberately (by SQL or
  // another admin) is 'manual' and survives any config change.
  //
  // The platform owner is exempt: their own grant is tagged 'bootstrap' too, so
  // without this a transient unconfirmed-email state would DELETE the owner's
  // stored role — the one thing the in-source fallback list exists to prevent.
  if (
    !byEmail &&
    !isPlatformOwnerEmail(email) &&
    role === "super_admin" &&
    roleSource === "bootstrap"
  ) {
    const demoted = await revokeBootstrapSuperAdmin(user.id);
    if (demoted) role = "user";
  }

  // A suspended or revoked account loses admin. Only the in-source platform
  // owner is exempt — gating this on `byEmail` would have made suspension inert
  // against every SUPER_ADMIN_EMAILS address, which is exactly the compromised
  // -account eviction this is meant to enable.
  const roleAdminActive = role === "super_admin" && accountStatus === "active";
  const isSuperAdmin =
    roleAdminActive ||
    (byEmail && (isPlatformOwnerEmail(email) || accountStatus === "active"));

  if (isSuperAdmin) {
    // "permanent" requires an EXPLICIT 'manual' tag. Anything else — a
    // 'bootstrap' grant, an untagged role (promoted before 0018), or a grant
    // that exists only by email because the tagging write failed — is
    // provisional.
    //
    // This fails CLOSED on purpose. Treating an untagged grant as permanent
    // meant that with 0018 unapplied, or with no service-role key to write the
    // tag, every allow-list address silently received the full toolset and
    // could never be revoked — the opposite of what the tier is for. It also
    // closes the one-request window where the tag had been written but this
    // request's `roleSource` was read before that write.
    //
    // The owner short-circuits first, so none of this can lock them out.
    const adminTier: AdminTier = isPlatformOwnerEmail(email)
      ? "owner"
      : roleSource === "manual"
        ? "permanent"
        : "provisional";

    return {
      userId: user.id,
      email: user.email ?? null,
      role: "super_admin",
      plan: "premium", // highest tier — full access
      accountStatus: "active",
      accessType: "lifetime_pro",
      isSuperAdmin: true,
      adminTier,
    };
  }

  if (accountStatus !== "active") {
    return {
      userId: user.id,
      email: user.email ?? null,
      // Normalised to "user": a consumer must never read a super_admin role
      // off an account that was deliberately suspended.
      role: "user",
      plan: "free",
      accountStatus,
      accessType: null,
      isSuperAdmin: false,
      adminTier: null,
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
  // A null expiry means "no end date" — correct for a granted access_type.
  const notExpired = (iso: string | null | undefined) =>
    !iso || new Date(iso).getTime() > now;
  // A PAID period must have a real end date. Treating null as "never expires"
  // meant a row left at plan='pro'/status='active' with no period (which is
  // exactly what admin "Remove Pro access" used to leave behind) granted the
  // tier forever, to someone who never paid.
  const periodLive = (iso: string | null | undefined) =>
    !!iso && new Date(iso).getTime() > now;

  // The paid tier stored on the subscription row ("pro" | "premium").
  const paidTier: PlanId = sub?.plan === "premium" ? "premium" : "pro";

  let plan: PlanId = "free";
  const accessType = sub?.access_type ?? null;
  if (sub) {
    if (accessType === "lifetime_pro") {
      plan = paidTier;
    } else if (accessType === "complimentary_pro") {
      plan = notExpired(sub.access_expires_at) ? paidTier : "free";
    } else if (
      (sub.plan === "pro" || sub.plan === "premium") &&
      sub.status === "active"
    ) {
      plan = periodLive(sub.current_period_end) ? paidTier : "free";
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
    adminTier: null,
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
