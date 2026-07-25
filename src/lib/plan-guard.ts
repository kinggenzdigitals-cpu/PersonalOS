import "server-only";
import { PLANS } from "@/lib/plans";
import { getActivePlan } from "@/lib/queries/billing";

/** Countable Free-plan caps and their human-readable noun. */
const CAP_NOUN = {
  accounts: "accounts",
  goals: "savings goals",
  habits: "habits",
  budgets: "budgets",
} as const;

export type CapKey = keyof typeof CAP_NOUN;

/**
 * Returns an upgrade message if creating one more `key` row would exceed the
 * user's plan cap, otherwise null. The caller passes the current row count so
 * this stays type-safe (no dynamic table names).
 */
export async function checkCap(
  key: CapKey,
  currentCount: number,
): Promise<string | null> {
  const plan = await getActivePlan();
  const limit = PLANS[plan].limits[key];
  if (typeof limit !== "number") return null; // unlimited
  if (currentCount >= limit) {
    return `Your Free plan includes up to ${limit} ${CAP_NOUN[key]}. Upgrade to Pro for unlimited.`;
  }
  return null;
}

/** True if the user's plan unlocks a boolean Pro feature. */
export async function hasProFeature(
  feature: "csvExport" | "netWorth",
): Promise<boolean> {
  const plan = await getActivePlan();
  return PLANS[plan].limits[feature] === true;
}

/** How many months of report history the user's plan can view (null = all). */
export async function reportsMonthsLimit(): Promise<number | null> {
  const plan = await getActivePlan();
  return PLANS[plan].limits.reportsMonths;
}
