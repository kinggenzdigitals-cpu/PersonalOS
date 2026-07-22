# Life OS

A mobile-first **Personal Life OS** — holistic habit tracking, mood check-ins,
tasks & priorities, a unified calendar, and daily money management in one calm
system. Built to the spec in [`spec.md`](./spec.md).

## Stack

| Layer      | Choice                                               |
| ---------- | ---------------------------------------------------- |
| Framework  | Next.js 16 (App Router, TypeScript, Turbopack)       |
| Styling    | Tailwind CSS v4 + shadcn/ui (Terracotta Cream theme) |
| Fonts      | Fraunces (display) + Karla (UI) via `next/font`      |
| Backend/DB | Supabase (Postgres, Auth, Row Level Security)        |
| Charts     | Recharts                                             |
| Dates      | date-fns (default timezone `Asia/Manila`)            |
| Deploy     | Vercel                                               |

## Getting started

1. **Install deps** (already installed if you scaffolded here):

   ```bash
   npm install
   ```

2. **Create a Supabase project** and apply the migrations in
   [`supabase/migrations`](./supabase/migrations) — in order:
   `0001_init.sql` (schema, view, triggers, category seed) then
   `0002_rls.sql` (row-level security). Apply via the Supabase SQL editor,
   the Supabase CLI (`supabase db push`), or the MCP `apply_migration` tool.

3. **Enable auth providers** in Supabase: Email and Google OAuth. Set the
   redirect URL to `http://localhost:3000/auth/callback` (and your prod URL).

4. **Configure env**: copy `.env.local.example` → `.env.local` and fill in the
   Supabase URL + anon/publishable key.

5. **Run**:

   ```bash
   npm run dev
   ```

## Architecture notes

- **Auth & routing** — `src/proxy.ts` (Next 16's renamed middleware) refreshes
  the Supabase session on every request and guards routes. Unauthenticated
  users are sent to `/login`; onboarding is enforced by the `(app)` layout via
  `requireOnboardedProfile()`.
- **Routing** — `/` is a public marketing **landing page**; the authenticated
  app lives under `/home`, `/money`, `/habits`, `/calendar`, `/tasks`,
  `/reports`, `/settings`. `(auth)` holds sign-in/up/reset; `(app)` holds the
  authenticated shell with a **left sidebar** (persistent on desktop, a
  hamburger drawer + top bar on mobile) and Quick Add.
- **Derived balances** — account balances are **never stored**. The
  `account_balances` Postgres view computes `opening_balance + Σ(in) − Σ(out)`
  and runs with `security_invoker` so RLS still applies.
- **Design tokens** — all colors, radii, and shadows are CSS variables in
  `src/app/globals.css`, surfaced as Tailwind utilities (`bg-brand`,
  `text-sage`, `shadow-card`, …). Money/stat figures use the `tnum` class for
  tabular numerals.
- **Multi-user isolation** — every table has RLS `auth.uid() = user_id`. A new
  user is auto-provisioned (profile + seeded categories) by the
  `handle_new_user` trigger on signup.

## Build status

**Milestone 1 (Foundation) — complete.** Scaffold, design system, Supabase
client + auth, onboarding, app shell, and all SQL migrations (schema + RLS +
seed).

**Milestone 2 (Money core) — complete.** Accounts CRUD (create/edit/archive),
`account_balances` wiring, transactions (expense/income via Quick Add, transfer,
adjustment) with optimistic toasts + Undo, transactions list with filters +
day grouping + edit/delete, and a Money overview (totals, 6-month income/expense
trend, spending-by-category donut).

**Milestone 3 (Budgets & bills) — complete.** Budgets CRUD with spent/remaining
progress bars (green < 80% / amber 80–100% / red > 100%, "over by ₱X"), bills
CRUD with status chips (Upcoming / Due soon / Overdue) + last-paid, and the
one-tap **mark-as-paid** flow (confirms amount + account → creates a linked
expense → advances the due date by frequency, or closes a one-off). Dashboard
now shows the next bill, a budget/bill/low-balance **alerts strip**, and a
due-bills badge on the Money tab.

**Milestone 4 (Habits & mood) — complete.** Habit CRUD (name, life area, days of
week, in-app reminder), daily **tap-to-cycle** logging (none → completed →
skipped → missed → none) with streak logic (completed extends, skipped
preserves, missed/untouched breaks), weekly strip, per-habit detail (current +
longest streak, weekly/monthly consistency, month heatmap), and a stats page
(overall consistency, most-missed, best life area). **Mood** daily check-in
(1–5 emoji + energy/stress sliders + optional gratitude/wins/struggles/prayer/
journal), history calendar strip + 30-day mood/energy/stress line chart. Quick
Add now logs habits and mood; the dashboard has interactive habit chips with
streak flames, a mood chip, and a daily progress bar.

**Milestone 5 (Tasks & Dashboard) — complete.** Task CRUD with Today / Upcoming /
Backlog / Done tabs and per-row actions (complete, move to tomorrow, backlog,
cancel, reopen, edit, delete); **top-3 priorities** with the 3-per-day cap +
swap picker; **carry-over** prompt (move all overdue to today); Task in Quick
Add. The dashboard now has a working **Top-3 priorities** block, carry-over
banner, a real **Today's schedule** (bills + task deadlines), and a daily
progress bar spanning habits + priorities.

**Milestone 6 (Calendar) — complete.** `calendar_events` CRUD (Event in Quick
Add), and a unified **Month / Week / Day** calendar that merges events, task
due dates, bill due dates, and scheduled habits — colored by source, with
filter chips (Events · Tasks · Bills · Habits), prev/next/today navigation, and
a tap-to-detail sheet offering contextual actions (edit event, mark task done,
mark bill paid, open habit).

**Milestone 7 (Reports & polish) — complete.** On-demand **weekly/monthly
reports** (money income/expense/net + savings inflow + spend-by-category + top
merchants + budgets met/exceeded; habit completion + per-area + most-missed;
mood averages; task completed/top-3 hit-rate/carried-over) with a
plain-language auto summary and period navigation. **PWA**: web manifest,
service worker with offline fallback, generated app icons, installable
standalone. **Settings** page (name, currency, timezone, week start,
low-balance threshold), profile menus (Tasks/Reports/Settings/Sign out) on
mobile + desktop, a Sunday/1st **review nudge**, and app-wide loading
skeletons, an error boundary, and a 404 page.

All 7 milestones are code-complete. `npm run build` and `npm run lint` pass
clean. The remaining step is connecting Supabase (see **Getting started**) so
the app can run and be verified end-to-end.

**Extension — Receivables & Payables + Cash Position.** A ledger module
(`ledger_entries`, migration `0003_ledger.sql`) tracking money owed to you
(receivables) and money you owe (payables), works for business (invoices /
supplier POs) or personal (utang / pautang). Money → **Owed** sub-tab shows
Total Receivable / Overdue / Total Payable / Overdue stat cards plus grouped
lists; **mark received/paid** creates the matching income/expense transaction
and updates the account balance. The Money overview gains a **Cash Position**
section (per-account balances) and a receivables/payables summary.
