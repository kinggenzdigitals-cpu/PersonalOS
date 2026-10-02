/**
 * Plan resolution from stored rows, as pure functions so
 * scripts/entitlement-core.test.cjs can run them on bare node.
 * getEntitlement() in lib/entitlement.ts and the admin user list in
 * lib/admin/users.ts both resolve the plan here, so the rule exists once.
 *
 * Whether a row is live at all is isAccessLive(), which the checkout and
 * webhook rules in lib/checkout-eligibility.ts already use — reusing it keeps
 * "may this user buy?" and "what does this user get?" from disagreeing.
 */
import { isAccessLive, type ExistingAccess } from "./checkout-eligibility";

export type PlanTier = "free" | "pro" | "premium";

/**
 * The plan a subscriptions row grants right now:
 *   lifetime_pro      → its tier, forever
 *   complimentary_pro → its tier until access_expires_at (forever if null)
 *   promo             → its tier until access_expires_at (null = expired)
 *   paid / none       → its tier while plan is pro/premium, status is
 *                       active and current_period_end is in the future
 *   anything else     → free
 *
 * A PAID period must have a real end date. Treating null as "never expires"
 * meant a row left at plan='pro'/status='active' with no period (which is
 * exactly what admin "Remove Pro access" used to leave behind) granted the
 * tier forever, to someone who never paid.
 */
export function resolvePlan(
  sub: ExistingAccess | undefined,
  nowMs: number,
): PlanTier {
  if (!sub || !isAccessLive(sub, nowMs)) return "free";
  return sub.plan === "premium" ? "premium" : "pro";
}

/**
 * The plan an account holds from its stored profile and subscription alone.
 * Suspended or revoked accounts get Free regardless; a super_admin role is
 * Premium. This is the admin user list's view — getEntitlement() also admits
 * the owner email allow-list, which lives outside the database.
 */
export function effectivePlan(
  role: string,
  status: string,
  sub: ExistingAccess | undefined,
  nowMs: number,
): PlanTier {
  if (status !== "active") return "free";
  if (role === "super_admin") return "premium";
  return resolvePlan(sub, nowMs);
}
