/**
 * The dashboard card registry. One entry per toggleable Home card, so the
 * customiser and the page render from the same list. Client-safe.
 */
import type { DashboardPrefs } from "@/lib/supabase/types";

export type DashboardCardKey =
  | "alerts"
  | "monthly_budget"
  | "cash_available"
  | "cash_flow"
  | "upcoming_bills"
  | "savings"
  | "sinking_funds"
  | "recent_transactions"
  | "health_score"
  | "priorities"
  | "habits"
  | "focus"
  | "schedule";

export type DashboardCard = {
  key: DashboardCardKey;
  label: string;
  description: string;
  group: "Money" | "Life";
};

export const DASHBOARD_CARDS: DashboardCard[] = [
  { key: "alerts", label: "Alerts", description: "Over-budget, overdue bills, low balances.", group: "Money" },
  { key: "monthly_budget", label: "Monthly budget", description: "Budget, spent, remaining and what's unallocated.", group: "Money" },
  { key: "cash_available", label: "Cash available", description: "Balance per account.", group: "Money" },
  { key: "cash_flow", label: "Month-end forecast", description: "Projected balance after upcoming bills.", group: "Money" },
  { key: "upcoming_bills", label: "Upcoming bills", description: "What's due for the rest of the month.", group: "Money" },
  { key: "savings", label: "Savings progress", description: "Progress across your savings goals.", group: "Money" },
  { key: "sinking_funds", label: "Sinking funds", description: "Dated goals and the monthly amount to set aside.", group: "Money" },
  { key: "recent_transactions", label: "Recent transactions", description: "Your latest activity.", group: "Money" },
  { key: "health_score", label: "Financial health", description: "A transparent 0–100 score and what drives it.", group: "Money" },
  { key: "priorities", label: "Top 3 priorities", description: "Today's most important tasks.", group: "Life" },
  { key: "habits", label: "Habits", description: "Today's habit check-ins.", group: "Life" },
  { key: "focus", label: "Focus", description: "Focus-session widget.", group: "Life" },
  { key: "schedule", label: "Today's schedule", description: "Bills and tasks due today.", group: "Life" },
];

/** Cards hidden by default for nobody — everything is on until switched off. */
export function isCardVisible(
  key: DashboardCardKey,
  prefs: DashboardPrefs | null | undefined,
): boolean {
  const hidden = prefs?.hidden;
  return !Array.isArray(hidden) || !hidden.includes(key);
}

/** Normalise arbitrary stored JSON into a safe prefs object. */
export function readPrefs(value: unknown): DashboardPrefs {
  if (!value || typeof value !== "object") return {};
  const hidden = (value as DashboardPrefs).hidden;
  if (!Array.isArray(hidden)) return {};
  const valid = new Set(DASHBOARD_CARDS.map((c) => c.key as string));
  return { hidden: hidden.filter((k) => typeof k === "string" && valid.has(k)) };
}
