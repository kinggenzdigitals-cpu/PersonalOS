/**
 * Subscription plans — the single source of truth for tiers, billing periods,
 * prices, discounts and limits. Every pricing/limit consumer reads from here
 * (never hardcodes prices). Editable-by-admin DB tables are a later phase; this
 * config is the canonical default.
 *
 * The marketing bullets are the one thing NOT defined here: they come from
 * plan-features.ts so they sit beside the comparison table that makes the same
 * promises. Kept in two places they drifted, and the bullets — the only pricing
 * copy a signed-out prospect sees — were the half that stayed wrong.
 */

import { PLAN_BULLETS } from "@/lib/plan-features";

export type PlanId = "free" | "pro" | "premium";

export type BillingPeriod = "monthly" | "quarterly" | "semiannual" | "annual";

export const BILLING_PERIODS: {
  id: BillingPeriod;
  label: string;
  months: number;
  badge?: string;
}[] = [
  { id: "monthly", label: "Monthly", months: 1 },
  { id: "quarterly", label: "3 Months", months: 3 },
  { id: "semiannual", label: "6 Months", months: 6, badge: "Popular Choice" },
  { id: "annual", label: "1 Year", months: 12, badge: "Best Deal" },
];

export type PriceRow = {
  total: number; // total charged for the period
  monthlyEq: number; // effective monthly price
  discountPct: number; // vs monthly
  save: number; // amount saved vs paying monthly for the same months
};

/** Prices per paid plan × billing period (PHP). */
export const PLAN_PRICES: Record<
  Exclude<PlanId, "free">,
  Record<BillingPeriod, PriceRow>
> = {
  pro: {
    monthly: { total: 129, monthlyEq: 129, discountPct: 0, save: 0 },
    quarterly: { total: 349, monthlyEq: 116.33, discountPct: 10, save: 38 },
    semiannual: { total: 649, monthlyEq: 108.17, discountPct: 16, save: 125 },
    annual: { total: 1099, monthlyEq: 91.58, discountPct: 29, save: 449 },
  },
  premium: {
    monthly: { total: 199, monthlyEq: 199, discountPct: 0, save: 0 },
    quarterly: { total: 549, monthlyEq: 183.0, discountPct: 8, save: 48 },
    semiannual: { total: 999, monthlyEq: 166.5, discountPct: 16, save: 195 },
    annual: { total: 1699, monthlyEq: 141.58, discountPct: 29, save: 689 },
  },
};

export type PlanLimits = {
  transactionsPerMonth: number | null;
  accounts: number | null;
  habits: number | null;
  goals: number | null;
  budgets: number | null;
  recurring: number | null;
  reminders: number | null;
  // Unread by any code path: nothing generates a PDF and nothing saves a
  // search. They are kept as the intended shape of those features, not as a
  // claim — do not turn either number back into customer-facing copy until
  // something enforces it. `customThemes` is read once, and only as `> 0`.
  pdfExportsPerMonth: number;
  customThemes: number;
  savedSearches: number;
  reportsMonths: number | null;
  csvExport: boolean;
  netWorth: boolean;
};

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  label?: string; // "Most Popular" / "Highest Limits"
  priceMonthly: number; // compat: monthly total
  priceYearly: number; // compat: annual total
  limits: PlanLimits;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Everything to run your everyday life.",
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      transactionsPerMonth: 100,
      accounts: 2,
      habits: 3,
      goals: 1,
      budgets: 2,
      recurring: 1,
      reminders: 3,
      pdfExportsPerMonth: 0,
      customThemes: 0,
      savedSearches: 0,
      reportsMonths: 1,
      csvExport: false,
      netWorth: false,
    },
    features: PLAN_BULLETS.free,
    cta: "Get started free",
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "More room to run your whole financial life.",
    label: "Most Popular",
    priceMonthly: 129,
    priceYearly: 1099,
    limits: {
      transactionsPerMonth: 500,
      accounts: 8,
      habits: 15,
      goals: 5,
      budgets: 10,
      recurring: 15,
      reminders: 25,
      pdfExportsPerMonth: 5,
      customThemes: 3,
      savedSearches: 5,
      reportsMonths: 12,
      csvExport: true,
      netWorth: true,
    },
    features: PLAN_BULLETS.pro,
    cta: "Start Pro",
    highlighted: true,
  },
  premium: {
    id: "premium",
    name: "Premium",
    tagline: "The highest limits, for power users.",
    label: "Highest Limits",
    priceMonthly: 199,
    priceYearly: 1699,
    limits: {
      transactionsPerMonth: 2000,
      accounts: 25,
      habits: 50,
      goals: 20,
      budgets: 30,
      recurring: 50,
      reminders: 100,
      pdfExportsPerMonth: 25,
      customThemes: 10,
      savedSearches: 20,
      reportsMonths: 60,
      csvExport: true,
      netWorth: true,
    },
    features: PLAN_BULLETS.premium,
    cta: "Start Premium",
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "premium"];

/** Rank for comparing tiers (higher = more access). */
export const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, premium: 2 };

/** The price row for a paid plan + period. */
export function planPrice(plan: PlanId, period: BillingPeriod): PriceRow | null {
  if (plan === "free") return null;
  return PLAN_PRICES[plan][period];
}

/** Yearly price shown per-month (compat helper for the Settings card). */
export function monthlyEquivalent(plan: Plan): number {
  return plan.priceYearly > 0 ? Math.round(plan.priceYearly / 12) : 0;
}

/** Everyone is Free until entitlement resolves the real tier. */
export function getUserPlan(): PlanId {
  return "free";
}
