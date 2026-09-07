# Supabase and admin readiness: 2026-09-07

## Verified scope

The connected `Personal OS` Supabase project is healthy and belongs to the
`kinggenzdigitals-OS` organization on the Free plan. Only read-only catalog queries,
migration/branch listings, and security-advisor checks were run. No customer
records, financial amounts, passwords, or keys were read. No live SQL was applied.

| Check | Observed result |
| --- | --- |
| Public tables | 17; all have RLS enabled |
| Existing policies | Tracking tables restrict USING and WITH CHECK to the owner; subscriptions allow owner SELECT only |
| Migration history | Empty; this does not mean the database is empty |
| Baseline objects | Checked objects from 0001 and 0003-0006 exist; RLS from 0002 is present |
| Missing application schema | Focus sessions, admin fields/feedback/audit, invitations, promotions, monthly budgets/goals, security/error history, checkout ledger, and schema marker |
| Development branches | None visible |
| Vercel project configuration | Connected tool returned no teams; the app's environment variables could not be verified |
| Xendit | Deferred by owner; no payment-provider changes or live payments |

`supabase/checks/security-readiness.sql` reproduces the read-only object inventory.
It is an inventory, not a complete schema diff or migration-history proof.

## Security-advisor findings

| Finding | Prepared response |
| --- | --- |
| Mutable search path in `set_updated_at` | New migration fixes the search path. [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) |
| Anonymous execution grant on `handle_new_user` | Revoke direct EXECUTE; preserve the Auth signup trigger. The function returns a trigger, so the warning alone is not proof of an exploitable REST endpoint. [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) |
| Signed-in execution grant on `handle_new_user` | Same revocation, tested without breaking profile/category seeding. [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| Leaked-password protection disabled | Dashboard/auth configuration remains pending; check plan availability before enabling. [Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |

The first three findings have fixes prepared in the feature branch. They remain
unresolved on the live project until a reviewed migration is applied. No current
security-advisor result can certify the whole application as secure.

## Code changes prepared and tested

The new migration `20260907152123_security_admin_hardening.sql` was created through
the Supabase CLI. It requires 0001-0012 and writes application schema marker 13.
It blocks deleting/recreating a profile to become an admin, limits writable profile
columns, protects internal feedback notes and server-owned records, and makes
Data API grants explicit. Existing migration files are unchanged.

The subsequent section-7 migration `20260907154543_account_reconciliation.sql`
requires that hardening migration and adds manual balance comparisons plus
transaction account locking. It sets schema marker 14. See
[bank connection readiness](./bank-connections-release.md) for coverage and
additional staging checks. Neither new migration has been applied live.

The server client has a build-time `server-only` guard. Email-based owner bootstrap
requires a verified email. Admin data access checks the admin role, handles pagination, includes Premium users in totals, and reports
failed health queries as unavailable. JSON export reads every page and returns an
error instead of a partial download if a page fails. Export is not a transactional
database backup or a point-in-time snapshot while records are being edited.

Account deletion uses the current session's verified authentication-method
timestamp, not the account-wide last-login time. It revokes refresh sessions
before deleting the authenticated account. Existing access JWTs can remain valid
until expiry; sign-out is not immediate JWT invalidation. Staging must verify that
deleted-user records and ownership constraints prevent continued data access.
See [Supabase JWT fields](https://supabase.com/docs/guides/auth/jwt-fields).

## Staging and release sequence

| Step | Required action |
| --- | --- |
| 1 | Confirm the organization for a separate test project and obtain a cost quote before creation. No paid branch, upgrade, or project was created. |
| 2 | Initialize a fresh test database with 0001-0012, then the hardening and account-reconciliation migrations, in timestamp order; use synthetic users only. |
| 3 | Point a branch-specific Vercel Preview at the test project's URL, publishable/anon key, and server secret together. Never combine a staging URL with a production key. Verify the server key without displaying it. |
| 4 | Test real Supabase Auth/PostgREST: two-user isolation, signup, profile settings, complete export, tracking reset, recent-login deletion, admin access, and private notes. Re-run security advisors. |
| 5 | Reconcile the live schema and migration history against an actual schema diff and verified backup. Objects from 0007-0012 are missing; do not apply only 0011/0012 or re-run 0001-0006. |
| 6 | Review staging results before any production migration or merge. Xendit stays deferred and checkout must not be enabled without sandbox validation. |

The connected organization is Free. Supabase documents managed daily database
backups for Pro, Team, and Enterprise; Free projects should maintain their own
off-site exports. A restore test and secure backup destination are still needed.
Database backups also exclude Storage object contents. [Backup documentation](https://supabase.com/docs/guides/platform/backups)

MFA/passkeys, automated backup configuration, live Auth/PostgREST verification,
and Vercel secret verification remain pending. An app JSON export is not a complete
database/Auth/Storage recovery backup.
