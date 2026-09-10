/**
 * Founding Lifetime offer — the single source of truth for the one-time
 * Lifetime Premium launch price and its scarcity rules.
 *
 * Deliberately dependency-free (no imports): the same tsc-then-bare-node test
 * harness the other pure libs use compiles this file on its own, and anything
 * imported here would break that. Client-safe for the same reason promo-config
 * is — the marketing page and popup render the price straight from here, and
 * the checkout action re-reads it SERVER-SIDE so a tampered client can never
 * change what is charged.
 *
 * Prices are USD (§13): this is a software product sold internationally. USD is
 * the base of record here; what a provider can actually CHARGE in is a merchant
 * setting the checkout adapter verifies, never something this config assumes.
 *
 * Admin-editable persistence (an offers table) is a later phase; until then
 * this is the canonical default and the only place any Lifetime number lives.
 */

export const LIFETIME_OFFER = {
  campaign: "founding-lifetime",
  /** Master switch. When false the offer is unavailable regardless of count. */
  active: true,
  /** Lifetime grants Premium-tier access with no recurring charge. */
  plan: "premium" as const,
  currency: "USD" as const,
  launchPriceUSD: 99,
  regularPriceUSD: 149,
  /**
   * Real scarcity: the first N buyers get the launch price. `null` disables the
   * count limit. The number that shows on the page is derived from ACTUAL paid
   * purchases (see src/lib/offer.ts), never a hand-set figure.
   */
  maxRedemptions: 100 as number | null,
  /**
   * Optional server-set deadline (ISO 8601). `null` = no time limit, scarcity
   * is by count only. A real timestamp here is honoured server-side; it is not
   * a per-visitor countdown that restarts.
   */
  endsAt: null as string | null,
} as const;

export type LifetimeOfferState = {
  /** Purchasable at the launch price right now. */
  available: boolean;
  soldOut: boolean;
  expired: boolean;
  /** Slots left at the launch price; null when there is no count limit. */
  remaining: number | null;
  /** What a buyer pays now: launch price while available, else regular. */
  priceUSD: number;
  regularUSD: number;
};

/**
 * Pure resolver for the offer's current state. `nowMs` and `sold` are passed in
 * rather than read here so this stays deterministic and unit-testable; the
 * server wrapper supplies the real clock and the real purchase count.
 */
export function lifetimeOfferState(input: {
  active: boolean;
  maxRedemptions: number | null;
  sold: number;
  endsAt: string | null;
  nowMs: number;
  launchPriceUSD: number;
  regularPriceUSD: number;
}): LifetimeOfferState {
  const sold = Math.max(0, Math.floor(input.sold));

  const remaining =
    input.maxRedemptions == null
      ? null
      : Math.max(0, input.maxRedemptions - sold);

  const soldOut = remaining != null && remaining <= 0;

  const endMs = input.endsAt ? Date.parse(input.endsAt) : NaN;
  // A malformed endsAt must not silently expire (or un-expire) the offer, so an
  // unparseable value is treated as "no deadline set" rather than 0 / NaN.
  const expired = Number.isFinite(endMs) && input.nowMs > endMs;

  const available = input.active && !soldOut && !expired;

  return {
    available,
    soldOut,
    expired,
    remaining,
    priceUSD: available ? input.launchPriceUSD : input.regularPriceUSD,
    regularUSD: input.regularPriceUSD,
  };
}
