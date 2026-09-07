-- ============================================================================
-- Finance & Habit Tracker — 0012 Budget extras
--   • Per-category carry-over (roll unspent budget into the next month)
--   • Sinking funds: an optional target date on savings goals, so a goal with a
--     deadline becomes a sinking fund (required monthly contribution is derived).
-- Additive + idempotent. Existing RLS on both tables already covers the columns.
-- ============================================================================

alter table public.budgets
  add column if not exists carryover boolean not null default false;

alter table public.savings_goals
  add column if not exists target_date date;
