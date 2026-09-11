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
      regular: 899,
      promo: 699,
      save: 200,
      monthly: 58.25,
    },
    premium: {
      name: "Premium Annual",
      regular: 1399,
      promo: 1099,
      save: 300,
      monthly: 91.58,
    },
  },
} as const;

export type PromoPlan = keyof typeof PROMO.offers;
