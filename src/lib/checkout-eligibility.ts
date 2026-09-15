/**
 * Who may start a paid checkout, and whether an arriving payment may be
 * applied. Pure and dependency-free so the test harness can compile it alone.
 *
 * Why it exists: every activation path — the payment webhook and the
 * free-promo branch — writes the single subscriptions row keyed on user_id. So
 * a purchase applied on top of existing access REPLACES it:
 *
 *   - a Lifetime holder buying a monthly plan would be rewritten to a dated
 *     paid period, and lose permanent access when it lapsed;
 *   - a live complimentary grant would be replaced the same way;
 *   - a promo redeemed during an active plan would reset the period to the
 *     promo's shorter window, cutting off time already paid for;
 *   - a Premium subscriber buying Pro would be Pro for all the Premium time
 *     they had already paid for.
 *
 * The rule is enforced twice. checkoutBlockReason() refuses to START such a
 * checkout, from the entitlement the server resolved. activationConflict()
 * refuses to APPLY such a payment, from the subscriptions row as it is when
 * the payment arrives — because a checkout opened before the customer's access
 * changed can still be paid afterwards.
 */
export type CheckoutKind = "subscription" | "promo" | "lifetime";
export type PaidTier = "pro" | "premium";

export type EligibilityInput = {
  isSuperAdmin: boolean;
  accessType: string | null;
  plan: "free" | "pro" | "premium";
};

export function checkoutBlockReason(
  ent: EligibilityInput,
  kind: CheckoutKind,
  targetPlan?: PaidTier,
): string | null {
  if (ent.isSuperAdmin) {
    return "Admin accounts already have full access, so there's nothing to buy.";
  }
  if (ent.accessType === "lifetime_pro") {
    return "You already have lifetime access, so there's nothing to buy.";
  }

  // The entitlement engine already reports "free" once any grant or period has
  // run out, so this is true only while access is genuinely live.
  const hasLiveAccess = ent.plan !== "free";

  if (kind === "promo" && hasLiveAccess) {
    return "Promo codes are for accounts without an active plan. You can use one after your current access ends.";
  }

  if (kind === "subscription" && hasLiveAccess) {
    // A live complimentary grant would be destroyed by a paid period.
    if (ent.accessType === "complimentary_pro") {
      return "You have complimentary access right now. Buying a plan would replace it, so contact support if you'd like to switch.";
    }
    // Renewing the same tier extends from the current end date, and moving UP
    // to Premium only adds features. Moving DOWN would turn every remaining
    // paid Premium day into Pro.
    if (ent.plan === "premium" && targetPlan === "pro") {
      return "You're on Premium right now. You can switch to Pro once your current period ends.";
    }
  }

  return null;
}

/** The subscriptions columns needed to tell whether access is live. */
export type ExistingAccess = {
  plan: string | null;
  status: string | null;
  access_type: string | null;
  access_expires_at: string | null;
  current_period_end: string | null;
} | null;

/**
 * Whether a subscriptions row grants access right now. Mirrors getEntitlement()
 * in lib/entitlement.ts: Lifetime never ends; complimentary access with no end
 * date is permanent; a promo or paid period needs a real, future end date.
 */
export function isAccessLive(existing: ExistingAccess, nowMs: number): boolean {
  if (!existing) return false;
  const future = (iso: string | null) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return Number.isFinite(t) && t > nowMs;
  };
  switch (existing.access_type) {
    case "lifetime_pro":
      return true;
    case "complimentary_pro":
      return !existing.access_expires_at || future(existing.access_expires_at);
    case "promo":
      return future(existing.access_expires_at);
    default:
      return (
        (existing.plan === "pro" || existing.plan === "premium") &&
        existing.status === "active" &&
        future(existing.current_period_end)
      );
  }
}

/**
 * Why an arriving payment must NOT be applied, or null when it may be. A
 * non-null answer means the money was received for something that would
 * destroy access the customer already holds: the webhook records it for a
 * manual refund instead of overwriting.
 */
export function activationConflict(
  existing: ExistingAccess,
  payment: { kind: CheckoutKind; plan: PaidTier | null },
  nowMs: number,
): string | null {
  if (existing?.access_type === "lifetime_pro") {
    return payment.kind === "lifetime"
      ? "second Lifetime payment for an account that already holds Lifetime"
      : "payment would overwrite an existing Lifetime grant";
  }
  // Lifetime only ever adds access, whatever came before it.
  if (payment.kind === "lifetime") return null;
  if (!existing || !isAccessLive(existing, nowMs)) return null;

  if (payment.kind === "promo") {
    return "promo payment would replace live access with a shorter promo period";
  }
  if (existing.access_type === "complimentary_pro") {
    return "subscription payment would replace live complimentary access";
  }
  if (existing.plan === "premium" && payment.plan === "pro") {
    return "Pro payment would downgrade a live Premium period";
  }
  return null;
}
