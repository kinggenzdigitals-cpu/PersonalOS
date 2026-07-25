/**
 * Subscription plans. This is the single source of truth for tiers, prices,
 * limits, and feature lists — used by the pricing page and (later) billing +
 * feature gating. Enforcement is wired up when Stripe billing lands (Phase B).
 */

export type PlanId = "free" | "pro";

export type PlanLimits = {
  accounts: number | null; // null = unlimited
  habits: number | null;
  budgets: number | null;
  goals: number | null;
  reportsMonths: number | null;
  csvExport: boolean;
  netWorth: boolean; // assets & liabilities tracking
};

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthly: number; // in the app's default currency (PHP)
  priceYearly: number;
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
      accounts: 3,
      habits: 10,
      budgets: 5,
      goals: 3,
      reportsMonths: 3,
      csvExport: false,
      netWorth: false,
    },
    features: [
      "Up to 3 accounts",
      "Up to 10 habits + mood tracking",
      "Tasks, calendar & daily dashboard",
      "5 budgets and bill reminders",
      "3 savings goals",
      "Last 3 months of reports",
    ],
    cta: "Get started free",
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Unlimited everything, for your whole financial life.",
    priceMonthly: 199,
    priceYearly: 1990, // ~2 months free
    limits: {
      accounts: null,
      habits: null,
      budgets: null,
      goals: null,
      reportsMonths: null,
      csvExport: true,
      netWorth: true,
    },
    features: [
      "Everything in Free, plus:",
      "Unlimited accounts, habits & budgets",
      "Unlimited savings goals",
      "Net worth: assets & liabilities",
      "Full report history + CSV export",
      "Priority support",
    ],
    cta: "Start Pro",
    highlighted: true,
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro"];

/** Yearly price shown per-month (for the toggle). */
export function monthlyEquivalent(plan: Plan): number {
  return Math.round(plan.priceYearly / 12);
}

/**
 * The current user's plan. Everyone is on Free until billing (Phase B) is
 * connected; this is the single hook to change when subscriptions go live.
 */
export function getUserPlan(): PlanId {
  return "free";
}
