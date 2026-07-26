/**
 * The complete Free / Pro / Premium feature comparison, grouped by section.
 * A cell is either a value string, `true` (included), or `false` (not included).
 * Values mirror the limits in plans.ts — keep them in sync.
 */

export type FeatureCell = string | boolean;

export type FeatureRow = {
  label: string;
  free: FeatureCell;
  pro: FeatureCell;
  premium: FeatureCell;
};

export type FeatureSection = { title: string; rows: FeatureRow[] };

export const FEATURE_SECTIONS: FeatureSection[] = [
  {
    title: "Financial tracking",
    rows: [
      { label: "Transactions / month", free: "100", pro: "500", premium: "2,000" },
      { label: "Wallets / accounts", free: "2", pro: "8", premium: "25" },
      { label: "Savings goals", free: "1", pro: "5", premium: "20" },
      { label: "Active budgets", free: "2", pro: "10", premium: "30" },
      { label: "Net worth tracking", free: false, pro: true, premium: true },
    ],
  },
  {
    title: "Habits & productivity",
    rows: [
      { label: "Active habits", free: "3", pro: "15", premium: "50" },
      { label: "Mood tracking", free: true, pro: true, premium: true },
      { label: "Focus timer (Pomodoro)", free: "Basic", pro: "Advanced", premium: "Advanced" },
    ],
  },
  {
    title: "Automation",
    rows: [
      { label: "Recurring schedules", free: "1", pro: "15", premium: "50" },
    ],
  },
  {
    title: "Calendar & reminders",
    rows: [
      { label: "Calendar views", free: "Month", pro: "Month · Week · Agenda", premium: "Month · Week · Agenda" },
      { label: "Active reminders", free: "3", pro: "25", premium: "100" },
      { label: "Browser / push reminders", free: false, pro: true, premium: true },
    ],
  },
  {
    title: "Reports & exports",
    rows: [
      { label: "Report history", free: "1 month", pro: "1 year", premium: "5 years" },
      { label: "Financial charts", free: false, pro: true, premium: true },
      { label: "Financial forecasting", free: false, pro: false, premium: true },
      { label: "CSV export", free: "Current month", pro: true, premium: true },
      { label: "PDF exports / month", free: "0", pro: "5", premium: "25" },
    ],
  },
  {
    title: "Customization",
    rows: [
      { label: "Custom theme palettes", free: "0", pro: "3", premium: "10" },
      { label: "Saved searches", free: "0", pro: "5", premium: "20" },
      { label: "Custom dashboard", free: false, pro: false, premium: true },
    ],
  },
  {
    title: "Security",
    rows: [
      { label: "Hide sensitive info", free: true, pro: true, premium: true },
      { label: "Passkeys & account recovery", free: true, pro: true, premium: true },
      { label: "PWA install + offline drafts", free: true, pro: true, premium: true },
    ],
  },
  {
    title: "Support",
    rows: [
      { label: "Support", free: "Community", pro: "Standard", premium: "Priority" },
    ],
  },
];
