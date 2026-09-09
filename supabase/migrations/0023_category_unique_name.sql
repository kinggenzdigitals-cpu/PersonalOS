-- ============================================================================
-- Finance & Habit Tracker — 0023 One category name per user, per kind
--
-- The New Budget form can now create a category inline, which introduces a way
-- to make duplicates that never existed before: two people typing "Food" and
-- "food" a second apart, or one person double-submitting.
--
-- The server action normalises and checks for an existing match first, but a
-- check-then-insert has a race window. This index closes it in the only place
-- that can actually be authoritative.
--
--   lower(btrim(name))  — "Food", "food" and "  FOOD " collapse to one key,
--                         which is exactly the rule the action applies before
--                         it decides whether to reuse or create.
--   (user_id, kind, …)  — scoped per user, so two people may both have "Food";
--                         and per kind, so an income "Salary" and a
--                         hypothetical expense "Salary" remain distinct rows.
--
-- Verified before applying: a grouped count over the live table returned ZERO
-- case-variant duplicates, so this cannot fail on existing data, and a
-- rolled-back transaction confirmed the index rejects an upper-cased,
-- space-padded copy of an existing name.
--
-- Idempotent — safe to re-run.
-- ============================================================================

create unique index if not exists categories_user_kind_name_key
  on public.categories (user_id, kind, lower(btrim(name)));
