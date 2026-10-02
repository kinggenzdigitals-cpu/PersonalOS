/**
 * The rules redeemPromoCode() applies before it writes anything: how long an
 * unpaid checkout holds its slot, what to do with the caller's own earlier
 * redemption, which codes count as invalid, and the attempt throttle. Pure and
 * dependency-free so the test harness can compile it alone.
 */

/** An unpaid promo checkout holds its max_redemptions slot this long. */
export const PENDING_HOLD_MS = 24 * 60 * 60 * 1000;

/** Pending rows last touched before this are released (marked expired). */
export function pendingCutoffIso(nowMs: number): string {
  return new Date(nowMs - PENDING_HOLD_MS).toISOString();
}

export type OwnRedemption = {
  status: string;
  invoice_external_id: string | null;
} | null;

/**
 * What to do with this account's existing row for the code (there is at most
 * one: unique (promo_code_id, user_id)):
 *
 *   new     no row — insert one;
 *   resume  an unpaid checkout, still pending or already expired — reuse the
 *           row AND its reference, so a late payment on the earlier PayMongo
 *           session still lands on it instead of on nothing;
 *   used    active, or canceled — this account has had this code.
 */
export function ownRedemptionAction(own: OwnRedemption): "new" | "resume" | "used" {
  if (!own) return "new";
  if ((own.status === "pending" || own.status === "expired") && own.invoice_external_id) {
    return "resume";
  }
  return "used";
}

/**
 * The one answer for a code that doesn't exist, is paused, or has expired.
 * Separate messages told a guesser which codes were real.
 */
export const INVALID_PROMO_MESSAGE = "That promo code isn't valid.";

/** True when the code exists, is switched on, and hasn't passed its end date. */
export function isRedeemable<T extends { active: boolean; expires_at: string | null }>(
  promo: T | null,
  nowMs: number,
): promo is T {
  if (!promo || !promo.active) return false;
  return !(promo.expires_at && new Date(promo.expires_at).getTime() <= nowMs);
}

/** Per account: attempts allowed in PROMO_USER_WINDOW_MS. */
export const PROMO_USER_ATTEMPTS = 10;
export const PROMO_USER_WINDOW_MS = 60 * 60 * 1000;
/** Across all accounts: invalid-code attempts allowed in PROMO_GLOBAL_WINDOW_MS. */
export const PROMO_GLOBAL_INVALID_ATTEMPTS = 60;
export const PROMO_GLOBAL_WINDOW_MS = 60 * 1000;

/**
 * Why this attempt is refused, or null to let it through. Both counts INCLUDE
 * the attempt being decided: it is recorded first and counted second, so a
 * burst of parallel requests can't all read a count from before any of them.
 */
export function promoAttemptBlocked(
  userAttempts: number,
  globalInvalidAttempts: number,
): string | null {
  if (userAttempts > PROMO_USER_ATTEMPTS) {
    return "Too many promo code attempts. Try again in an hour.";
  }
  if (globalInvalidAttempts > PROMO_GLOBAL_INVALID_ATTEMPTS) {
    return "Too many promo code attempts right now. Try again in a few minutes.";
  }
  return null;
}
