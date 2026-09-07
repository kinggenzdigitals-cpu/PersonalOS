# Monthly budget planner: release hold

Draft PR #3 is not ready for production merge until staging verification is complete.
Habit Tracker and the production database have not been changed by this work.

## What was corrected

- Migration 0011 now adds `monthly_category_budgets` and copies existing allotments into each owner's local month. It does not change or remove the legacy `budgets` table or its conflict key.
- Monthly totals include every recorded savings contribution, even if its allotment is deleted. Goal metadata edits no longer overwrite a saved balance from a stale form.
- Carry-over accumulates across consecutive completed months. A gap or disabled carry-over ends the chain. Future months never treat unfinished-month leftovers as confirmed funds.
- Recommendations mask amounts. Financial queries paginate and fail on read errors instead of reporting incomplete or zero totals.
- Cash-flow estimates count recurring bill occurrences and skip paid dates. Today's cash snapshot undoes future-dated transactions. Future months show planned income and known bills, not a misleading cash-balance forecast.
- Templates and copying use one transactional RPC for empty months only. A failure rolls back every write; existing allotments and monthly settings are not overwritten.

## Validation

`npm run test:budget` runs 24 regression tests, using the actual TypeScript source and an isolated PGlite PostgreSQL engine. The test setup loads migrations 0001-0012 and `20260907152123_security_admin_hardening.sql`, with synthetic auth users and grants. It omits the unused pgcrypto extension declaration because UUID generation is native in this test engine.

The read-only Supabase audit on 2026-09-07 found the baseline objects through 0006, no migration-history entries, and missing objects from 0007 onward. See [the audit](./supabase-readiness-2026-09-07.md) before choosing a rollout sequence.

Tests cover legacy writes, copied balances, month isolation, cross-user RLS and foreign keys, anonymous access, contribution atomicity, invalid amounts/dates, rollback of failed templates, retry safety, cumulative carry-over, savings totals, bill recurrence, timezone boundaries, future cash entries, pagination, stale goal edits and recommendation masking.

These are not live Supabase, OAuth, PostgREST, concurrency/load, or browser tests. [PGlite documentation](https://pglite.dev/docs/) describes the isolated test runtime.

## Staging and release gates

| Gate | Required check |
| --- | --- |
| Confirm target | Identify a non-production Supabase project. Check whether any version of 0011 has already been applied before running SQL. An applied migration must never be rewritten. |
| Preserve data | Obtain a verified database backup. Use synthetic data for staging. Compare legacy budgets and savings before/after migration. |
| Verify app | Point an isolated preview at staging. Test two-user sign-in, month switching, create/edit/delete allotments, templates, savings, reports, privacy toggle and existing Habit Tracker flows. |
| Coordinate cutover | The legacy table stays writable, but writes after the one-time copy do not automatically update the new monthly table. Quiesce budget edits during cutover and reconcile any intervening changes before enabling the new app. |
| Authorize release | Confirm staging results and the exact production project before applying SQL or merging. Keep the old tables; rolling back the app does not automatically copy new monthly edits back to legacy budgets. |

Savings contributions are manual records, not transfers or bank synchronization. Forecasts exclude unrecorded expenses and use estimates, not guaranteed balances. Starter templates do not bypass the app's plan limits; broader quota enforcement and load testing remain outside this validation pass.
