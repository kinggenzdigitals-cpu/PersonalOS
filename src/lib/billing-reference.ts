/**
 * The reference_number every PayMongo checkout carries. It is built here, on
 * the server, when checkout starts; it comes back inside the signed webhook
 * event; and it is the only thing the webhook uses to decide whose access to
 * activate and how. The signature means it can't be forged, but it is still
 * parsed strictly — a malformed value must never reach a write keyed on
 * user_id.
 *
 *   sub_<userId>_<plan>_<period>_<ms>     a paid subscription period
 *   sub_<userId>_<plan>_lifetime_<ms>     Founding Lifetime (one-time)
 *   promo_<userId>_<promoCodeId>_<ms>     a paid promo code
 *
 * getLifetimeSold() counts references containing `_lifetime_`, so that marker
 * is part of the format, not decoration. Pure and dependency-free so the test
 * harness can compile it alone.
 */

export type PaidTier = "pro" | "premium";
export type Period = "monthly" | "quarterly" | "semiannual" | "annual";

export const PERIOD_MONTHS: Record<Period, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export type ParsedReference =
  | { kind: "subscription"; userId: string; plan: PaidTier; period: Period }
  | { kind: "lifetime"; userId: string; plan: PaidTier }
  | { kind: "promo"; userId: string; promoCodeId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{1,16}$/;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

function isTier(value: string): value is PaidTier {
  return value === "pro" || value === "premium";
}

function isPeriod(value: string): value is Period {
  // hasOwnProperty, not `in`: "toString" must not pass for a billing period.
  return Object.prototype.hasOwnProperty.call(PERIOD_MONTHS, value);
}

export function buildSubscriptionReference(
  userId: string,
  plan: PaidTier,
  period: Period,
  nowMs: number,
): string {
  return `sub_${userId}_${plan}_${period}_${Math.floor(nowMs)}`;
}

export function buildLifetimeReference(
  userId: string,
  plan: PaidTier,
  nowMs: number,
): string {
  return `sub_${userId}_${plan}_lifetime_${Math.floor(nowMs)}`;
}

export function buildPromoReference(
  userId: string,
  promoCodeId: string,
  nowMs: number,
): string {
  return `promo_${userId}_${promoCodeId}_${Math.floor(nowMs)}`;
}

export function parseReference(value: unknown): ParsedReference | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) {
    return null;
  }
  const parts = value.split("_");
  const userId = parts[1] ?? "";
  const stamp = parts[parts.length - 1] ?? "";
  if (!isUuid(userId) || !TIMESTAMP.test(stamp)) return null;

  if (parts[0] === "sub" && parts.length === 5) {
    const plan = parts[2];
    const middle = parts[3];
    if (!isTier(plan)) return null;
    if (middle === "lifetime") return { kind: "lifetime", userId, plan };
    if (isPeriod(middle)) {
      return { kind: "subscription", userId, plan, period: middle };
    }
    return null;
  }

  if (parts[0] === "promo" && parts.length >= 4) {
    // The webhook looks the redemption up by the full reference, so the code
    // id is carried for traceability only; joining keeps any "_" inside it.
    const promoCodeId = parts.slice(2, -1).join("_");
    if (!promoCodeId) return null;
    return { kind: "promo", userId, promoCodeId };
  }

  return null;
}
