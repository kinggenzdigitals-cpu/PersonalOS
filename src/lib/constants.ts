import type { AccountType, LifeArea } from "@/lib/supabase/types";

// ---- Life areas ----------------------------------------------------------

export const LIFE_AREAS: {
  value: LifeArea;
  label: string;
  color: string;
}[] = [
  { value: "physical", label: "Physical", color: "#7C9082" },
  { value: "emotional", label: "Emotional", color: "#C4643B" },
  { value: "spiritual", label: "Spiritual", color: "#9A7BB0" },
  { value: "mental", label: "Mental", color: "#6B7F9E" },
  { value: "work", label: "Work", color: "#B08A4F" },
  { value: "relationships", label: "Relationships", color: "#C77D8E" },
  { value: "growth", label: "Growth", color: "#5B9AA0" },
];

export const LIFE_AREA_MAP = Object.fromEntries(
  LIFE_AREAS.map((a) => [a.value, a]),
) as Record<LifeArea, (typeof LIFE_AREAS)[number]>;

// ---- Suggested habits (onboarding picker; user chooses which to add) ------

export const SUGGESTED_HABITS: { name: string; life_area: LifeArea }[] = [
  { name: "Walking", life_area: "physical" },
  { name: "Exercise", life_area: "physical" },
  { name: "Sleep by 10pm", life_area: "physical" },
  { name: "Water intake", life_area: "physical" },
  { name: "Mood check-in", life_area: "emotional" },
  { name: "Gratitude", life_area: "emotional" },
  { name: "Prayer", life_area: "spiritual" },
  { name: "Bible reading", life_area: "spiritual" },
  { name: "Devotion", life_area: "spiritual" },
  { name: "Reading", life_area: "mental" },
  { name: "Learning", life_area: "growth" },
  { name: "Deep work", life_area: "work" },
  { name: "Client tasks", life_area: "work" },
  { name: "Family time", life_area: "relationships" },
  { name: "Personal project", life_area: "growth" },
];

// ---- Account types -------------------------------------------------------

export const ACCOUNT_TYPES: {
  value: AccountType;
  label: string;
  isSpendingDefault: boolean;
}[] = [
  { value: "cash", label: "Cash", isSpendingDefault: true },
  { value: "ewallet", label: "E-wallet", isSpendingDefault: true },
  { value: "bank", label: "Bank", isSpendingDefault: true },
  { value: "savings", label: "Savings", isSpendingDefault: false },
  { value: "other", label: "Other", isSpendingDefault: true },
];

// Suggested starting accounts offered during onboarding.
export const SUGGESTED_ACCOUNTS: {
  name: string;
  type: AccountType;
  is_spending: boolean;
}[] = [
  { name: "Cash", type: "cash", is_spending: true },
  { name: "GCash", type: "ewallet", is_spending: true },
  { name: "Maya", type: "ewallet", is_spending: true },
  { name: "Bank", type: "bank", is_spending: true },
  { name: "Savings", type: "savings", is_spending: false },
  { name: "Emergency Fund", type: "savings", is_spending: false },
];

// ---- Days of week --------------------------------------------------------

export const WEEKDAYS = [
  { value: 0, short: "Sun", label: "Sunday" },
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
];

// ---- Mood scale ----------------------------------------------------------

export const MOOD_FACES: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

export const NAV_TABS = [
  { href: "/", label: "Home", icon: "Home" },
  { href: "/calendar", label: "Calendar", icon: "Calendar" },
  { href: "/money", label: "Money", icon: "Wallet" },
  { href: "/habits", label: "Habits", icon: "Sparkles" },
] as const;
