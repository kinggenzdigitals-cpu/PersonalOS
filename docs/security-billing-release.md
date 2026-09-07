# Security, Admin, and Billing Release Checklist

This feature branch contains reviewed code changes, not a completed live rollout.
Keep PR #3 in draft until the database baseline and staging checks below pass.
Xendit connection and sandbox payment testing are explicitly deferred by the owner.

## Connected-project audit: 2026-09-07

Supabase access is verified. The live project has 17 public tables, all with RLS.
The checked baseline objects through 0006 exist, but there are no tracked migration
history entries. Tables/columns for 0007-0012 are absent. Do not blindly re-run
0001-0006 or start with 0011. There is no staging project/branch visible.
See [the full audit](./supabase-readiness-2026-09-07.md).

Status checkmarks below mean implemented in code unless explicitly described as
verified against the connected project. They do not mean deployed.

## Section 8: Security and Admin

| Status | Item |
| --- | --- |
| ✅ | Owner-only RLS for security history and checkout records |
| ✅ | Service-role key remains server-only |
| ✅ | Admin schema-version, payment-callback, error, and activity views |
| ✅ | Login and sensitive-action history |
| ✅ | Privacy-safe error event tracking with rate limiting |
| ✅ | Full personal-data JSON download |
| ✅ | Atomic tracking-data reset and permanent account deletion controls |
| ✅ | Verified-session recency and global session sign-out before account deletion |
| ✅ | Paginated exports and admin lists; failed health queries show unavailable |
| ✅ | Profile recreation/role escalation blocked in the new hardening migration |
| ✅ | Private admin notes, invitation records, and trigger RPCs protected |
| ✅ | Email-based owner bootstrap requires a verified email |
| ✅ | Premium subscriptions included in admin totals |
| ✅ | Supabase connection and read-only live schema/RLS audit |
| ❌ | Verify service-role configuration in staging and production |
| ❌ | Reconcile the baseline; apply and verify all pending migrations in staging |
| ❌ | Configure and test Supabase backups and restore procedure |
| ❌ | Add passkeys or two-factor authentication |

## Section 9: Business and Monetization

| Status | Item |
| --- | --- |
| ✅ | Pricing and displayed feature limits reviewed for current behavior |
| ✅ | One-time payment wording matches the current Xendit invoice flow |
| ✅ | Server-side checkout ledger stores the expected user, plan, period, and amount |
| ✅ | Webhook rejects mismatched amount/currency and safely handles duplicates |
| ✅ | Existing three-step onboarding wizard verified in the codebase |
| ✅ | Terms and privacy copy updated for Premium, payments, data controls, and future bank consent |
| ✅ | Concurrent promotional-offer claims protected |
| ❌ | Xendit connection and sandbox checkout/callback test: deferred by owner |
| ❌ | Build and test free-trial and promo-code redemption |
| ❌ | Have final terms and privacy wording reviewed by a qualified Philippine lawyer |
| ❌ | Build Android and iOS store versions later |

## Required staging checks

| Step | Check |
| --- | --- |
| 1 | Select the staging organization/project, confirm any cost, and preserve the live database backup. |
| 2 | On a fresh test project, apply 0001-0012, 20260907152123_security_admin_hardening.sql, and 20260907154543_account_reconciliation.sql in order (schema marker 14). On an existing project, reconcile the baseline first; never re-run installed objects blindly. |
| 3 | Sign in with two synthetic users and verify neither can read the other's records. |
| 4 | Test JSON export, tracking reset, recent-login account deletion, and admin system status. |
| 5 | Verify the new profile/feedback privileges using the Data API and inspect Supabase advisors. |
| 6 | Xendit tests are deferred. Before a payment release, test correct/wrong amounts, duplicate callbacks, and retry after a database error in sandbox. |
| 7 | Merge only after the relevant staging checks and release approval; keep paid checkout unavailable until Xendit is tested. |

Automated coverage currently passes 52 focused tests, including the isolated
PostgreSQL migrations, RLS isolation, atomic payment completion, duplicate
callbacks, pricing totals, monthly budget calculations, data-reset scope,
profile escalation attempts, admin-note access, 1,205-row export, failed-page
handling, verified-session recency, sign-out ordering, and unavailable health data.
Bank comparison/adjustment tests are described in [section 7](./bank-connections-release.md).
This does not replace staging tests against Supabase Auth/PostgREST or Xendit.
