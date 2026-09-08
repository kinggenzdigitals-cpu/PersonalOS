/**
 * Everything the app claims about Free / Pro / Premium, in one file: the full
 * comparison table (`FEATURE_SECTIONS`) and the short bullet list on every plan
 * card (`PLAN_BULLETS`, consumed by plans.ts).
 *
 * Both surfaces are a sales promise — the table sits above the Upgrade button
 * on /subscription, and the bullets are the *only* pricing copy a signed-out
 * prospect ever sees, on / and /pricing. They live together because they drifted
 * apart once already: the table was audited down to what the code does and the
 * bullets kept promising PDF exports, saved searches, an Agenda calendar and
 * priority support, none of which exist, plus a "current-month CSV" for Free,
 * which the export action rejects outright.
 *
 * Rules that keep them honest, enforced by scripts/plan-features.test.cjs:
 *   - a cell describes what the CODE does today, never what plans.ts hopes for.
 *     Before syncing a number back from plans.ts, check something actually
 *     reads that limit — several are decoration, and the row comments say which;
 *   - no row for a feature that does not exist. "Coming soon" is a promise, and
 *     a comparison table is the wrong place to make one: in the Free column it
 *     reads as "coming to you", and across all three it stops comparing;
 *   - no bullet may claim something the table marks as not included.
 */

/** Same three ids as plans.ts. Spelled out so this file imports nothing — see PLAN_BULLETS. */
type Tier = "free" | "pro" | "premium";

export type FeatureCell = string | boolean;

export type FeatureRow = {
  label: string;
  free: FeatureCell;
  pro: FeatureCell;
  premium: FeatureCell;
};

export type FeatureSection = { title: string; rows: FeatureRow[] };

/*
 * Deliberately absent, and what each needs before it earns a row again:
 *
 *   Browser / push reminders — a real subscription flow. There is no
 *     PushManager call, no VAPID key, no push/notificationclick handler in
 *     public/sw.js and no subscription table. (The one Notification in the
 *     codebase is the Pomodoro chime, which Free gets too.)
 *   PDF exports — a generator. No PDF library in package.json, no route or
 *     server action, no window.print, no print stylesheet, and nothing counting
 *     a monthly quota. Pro and Premium were sold 5 and 25 of nothing.
 *   Saved searches — somewhere to save one. No saved_searches table, no
 *     save/name/recall UI, no action; /money has client-side filters that reset
 *     on navigation and no free-text search over transactions at all.
 */
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
      // There is no Basic/Advanced split anywhere in the code: custom focus,
      // short- and long-break durations, the long-break interval, sound,
      // notification and task/habit linking all ship to every plan. Sell a
      // tiered timer only once focus-timer.tsx actually withholds something.
      { label: "Focus timer (Pomodoro)", free: true, pro: true, premium: true },
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
      // calendar-view.tsx renders the month/week/day switcher with no plan
      // check, so every tier has all three today — and no view is called
      // "Agenda": the third one is Day (it happens to render as a list). The
      // views are named in the label so three identical prose cells don't push
      // the table off a phone screen.
      { label: "Calendar views (month · week · day)", free: true, pro: true, premium: true },
      // The allowance is genuinely enforced (habits/actions.ts counts active
      // habits with a reminder_time), but the only thing that reads the value
      // back is the habit edit form, prefilling its own field — no card, no
      // dashboard, no alerts strip, and nothing fires it. Until something
      // surfaces it, this row sells storage, so it has to say so in the label
      // rather than let a bare "3 / 25 / 100" imply an alert.
      { label: "Reminder times stored (no alerts yet)", free: "3", pro: "25", premium: "100" },
    ],
  },
  {
    title: "Reports & exports",
    rows: [
      { label: "Report history", free: "1 month", pro: "1 year", premium: "5 years" },
      // Trend chart, category donut, account sparklines and budget-vs-actual
      // all render on /money with no entitlement check, so Free has them.
      // Only mark Free ✗ again together with an actual gate.
      { label: "Financial charts", free: true, pro: true, premium: true },
      // CashFlowCard renders on /home and /money/budgets, neither of which
      // looks at the plan, so the forecast is not Premium-exclusive in
      // practice. Named for what it forecasts, not "financial forecasting".
      { label: "Cash-flow forecast", free: true, pro: true, premium: true },
      // Free gets no CSV at all — exportTransactionsAction rejects on
      // requireProFeature before reading a row, and the button renders as an
      // upgrade link. The paid export is every transaction, not one month.
      { label: "CSV export (all transactions)", free: false, pro: true, premium: true },
    ],
  },
  {
    title: "Customization",
    rows: [
      // The Free lock is real, but 3-vs-10 palettes was not: customThemes is
      // read exactly once (settings/page.tsx) and only as `> 0`. There is no
      // saved-palette entity to count — paid users share one engine and one
      // flat list of swatches, capped at 24 for everyone. That list lives in
      // localStorage and nowhere else, so it does not follow the user to
      // another browser or survive clearing site data; advertising a number
      // for it would be selling a count nothing persists.
      { label: "Custom brand colours (saved on this device)", free: false, pro: true, premium: true },
      // The card customiser renders unconditionally on /home and
      // updateDashboardPrefs does no entitlement check, so every plan already
      // rearranges its dashboard.
      { label: "Custom dashboard", free: true, pro: true, premium: true },
    ],
  },
  {
    title: "Security",
    rows: [
      { label: "Hide sensitive info", free: true, pro: true, premium: true },
      // Was "Passkeys & account recovery". Recovery is real (the code-based
      // reset wizard); passkeys are not — no WebAuthn, no credential table, no
      // dependency, and the only sign-ins offered are password and Google.
      { label: "Account recovery", free: true, pro: true, premium: true },
      // Was "PWA install + offline drafts". Install is real (manifest.ts plus
      // the worker registered in production); drafts are not — public/sw.js
      // says offline writes are out of scope, and nothing queues an unsent
      // entry. Offline gets you a fallback page, not a saved draft.
      { label: "PWA install", free: true, pro: true, premium: true },
    ],
  },
  {
    title: "Support",
    rows: [
      // What is untiered here is the service *level*, not the existence of
      // support: /feedback gates on requireOnboardedProfile() with no plan
      // check and feeds the admin triage queue, and a support address is
      // published on /privacy, /terms and /suspended. So the row states the
      // channel every plan actually has. If Standard/Priority is a commitment
      // kept off-platform, put those words back deliberately — but never leave
      // a paying customer reading that support does not exist yet.
      { label: "In-app feedback board", free: true, pro: true, premium: true },
    ],
  },
];

/**
 * The bullets on each plan card (/pricing, the landing page, the /subscription
 * upgrade sheet, /account, the upsell modal).
 *
 * Shape matters to two callers: upgrade-provider.tsx shows `slice(1, 4)`, and
 * account/plan-card filter out anything starting with "Everything" — so the
 * paid tiers must keep that line first and their three strongest claims next.
 * Every number and capability below is a row in FEATURE_SECTIONS; the test
 * cross-checks them, so a limit change here fails until the table agrees.
 */
export const PLAN_BULLETS: Record<Tier, string[]> = {
  free: [
    "100 transactions / month",
    "2 wallets · 3 habits · 1 goal",
    "2 budgets · 1 recurring · 3 reminder times",
    "Today dashboard + month, week and day calendar",
    "Current-month reports with charts",
    // "Light/Dark" was dropped, not reworded: the app now ships dark-only
    // (forcedTheme in app/layout.tsx), so advertising a light mode sold a
    // switch that no longer exists anywhere in the UI. It was also the one
    // bullet with no matching row in FEATURE_SECTIONS above, so the
    // claims test could never have caught it going stale.
    "Privacy mode, PWA install, feedback board",
  ],
  pro: [
    "Everything in Free, plus:",
    "500 transactions / month",
    "8 wallets · 15 habits · 5 goals",
    "10 budgets · 15 recurring · 25 reminder times",
    "1-year report history + net worth tracking",
    "CSV export of all transactions",
    "Custom brand colours",
  ],
  premium: [
    "Everything in Pro, with higher limits:",
    "2,000 transactions / month",
    "25 wallets · 50 habits · 20 goals",
    "30 budgets · 50 recurring · 100 reminder times",
    "5-year report history + net worth tracking",
    "CSV export of all transactions",
    "Custom brand colours",
  ],
};
