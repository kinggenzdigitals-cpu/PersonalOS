/**
 * Promotional campaign config — the single source of truth for promo pricing.
 * Client-safe (no server-only imports) so the modal/banner can render prices.
 * Prices are never read from the DB or the client, so they can't be tampered
 * with; the offer row only stores started_at / expires_at.
 */
export const PROMO = {
  campaign: "annual-launch",
  minutes: 12,
  offers: {
    pro: {
      name: "Pro Annual",
      regular: 1099,
      promo: 899,
      save: 200,
      monthly: 74.92,
    },
    premium: {
      name: "Premium Annual",
      regular: 1699,
      promo: 1399,
      save: 300,
      monthly: 116.58,
    },
  },
} as const;

export type PromoPlan = keyof typeof PROMO.offers;
