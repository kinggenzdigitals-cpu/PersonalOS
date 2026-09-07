-- ============================================================================
-- Finance & Habit Tracker — 0015 Dashboard preferences
--
-- Per-user choice of which dashboard cards are visible, stored as
--   { "hidden": ["habits", "health_score", ...] }
-- Absent/empty = every card visible (the default).
--
-- profiles is already owner-scoped by RLS (0013 restricts it to SELECT+UPDATE),
-- and the privilege trigger only pins role/status/must_change_password, so this
-- column is writable by its owner and nothing else.
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists dashboard_prefs jsonb not null default '{}'::jsonb;
