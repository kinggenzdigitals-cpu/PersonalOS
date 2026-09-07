# Bank and wallet connections: section 7

This branch adds manual balance reconciliation. It does not connect to a bank,
retrieve a bank balance, or synchronize transactions. No bank credentials, API
keys, consent grants, or provider tokens were collected. Automatic connections
remain blocked on provider onboarding and verified product coverage.

## Implemented in code

| Status | Behavior |
| --- | --- |
| ✅ | Money → Bank connections clearly labels existing accounts as manual. |
| ✅ | Compare a user-entered bank/wallet balance or cash count with the tracker at a server-generated cutoff. |
| ✅ | Save matched or unresolved comparisons without changing transactions. |
| ✅ | Explicitly opt into a balance adjustment with a required reason; adjustments do not count as income or expenses. |
| ✅ | Show the latest 20 comparisons, respect the privacy mask, and include history in personal-data export/reset. |
| ❌ | Live BPI, GCash, Maya, or other bank authorization, consent/revocation, and automatic synchronization. |

The user should compare the same currency and cutoff. Available balances,
current/ledger balances, holds, and pending transactions can differ. This version
uses the profile's currency and does not convert foreign-currency accounts.
Tracker entries after the comparison cutoff are excluded; the older Money
Overview balance view can include future-dated entries. Comparisons are historical
observations entered by the user, not independent verification of bank records.

The preview expires after 15 minutes. Saving rechecks the owned account's ledger
under an account row lock. Transaction writes lock their source/destination
accounts, including transfers, edits, and deletions. A changed balance requires a
new comparison. A request ID makes repeated saves return the original result;
adjustment and history insert are one database transaction. Removing the linked
adjustment marks its comparison for review. Editing an adjustment later does not
rewrite the historical comparison. Account deletion also removes its comparisons.

The RPCs use SECURITY INVOKER, an empty search path, explicit execution grants,
and RLS. The history table permits owner SELECT/INSERT for these invoker RPCs,
but no ordinary owner UPDATE/DELETE. A caller can enter their own manual
observations through the Data API, so this is not a tamper-proof audit log.
Suspended users and archived accounts cannot create comparisons through the RPC.

## Provider research, checked 2026-09-07

| Candidate | Evidence and remaining questions |
| --- | --- |
| Brankas | Published coverage includes BPI balances/statements and Maya statements. Confirm the exact Maya product, bank-data sandbox access, hosted authorization method, and permitted production use. GCash bank-data access was not confirmed. [Coverage](https://www.brankas.com/coverage/) |
| Finverse | Its Philippine bank-data list includes Maya Bank and several other banks. Maya Bank coverage does not establish Maya wallet support. BPI/GCash support was not confirmed from that list. [Bank Data API](https://www.finverse.com/bank-data-api) |

Brankas is a candidate to evaluate first for the requested BPI flow, not a selected
or certified integration. Published coverage is not proof that this application
has access. Payment collection or disbursement support is not evidence that a
provider can read personal balances. Xendit remains deferred and is separate from
this bank-data integration.

## Requirements before automatic connection work

| Step | Required outcome |
| --- | --- |
| 1 | Obtain approved bank-data sandbox access and confirm BPI, GCash, Maya Bank/wallet, supported account types, currencies, data scopes, refresh limits, pricing, and contractual permission for this use. No provider account or contract was created here. |
| 2 | Review the selected provider's documented hosted authorization flow. Request read-only access; users must not type banking usernames, passwords, or OTPs into the tracker. Implement provider-specific state/nonce and redirect protections according to its docs. |
| 3 | Define consent scope, expiry, data retention, and disconnect behavior. Keep encrypted provider credentials server-side, bind every connection to its owner, and revoke provider access on disconnect. Decide separately whether the user retains or deletes imported history. |
| 4 | Implement synchronization against the provider's real sandbox: signature verification where webhooks exist, pagination, provider transaction IDs, retry/backoff, pending-to-posted updates, duplicate prevention, and rules for matching existing manual transactions. Keep bank snapshots separate from calculated tracker balances. |
| 5 | Verify reauthorization, expired/revoked consent, partial outages, transfer pairs, failed sync, currency mismatches, and account deletion. Display the provider's balance timestamp and last successful sync, with honest stale/unavailable states. |

Credentials must be configured through the hosting provider's secret settings,
never posted in chat or committed to GitHub. Provider-specific integration code
and live connection buttons should follow the approved sandbox documentation.

## Database and release sequence

The new CLI-created migration is
`20260907154543_account_reconciliation.sql`. On a fresh test database, apply
0001-0012, then `20260907152123_security_admin_hardening.sql`, then this migration.
It sets application schema marker 14. Do not apply it by itself to the current
live database: the earlier audit found missing prerequisite objects and empty
migration history. See [database readiness](./supabase-readiness-2026-09-07.md).

The focused suite now has 52 passing tests. Reconciliation coverage includes
future entries, transfers, zero/negative balances, matching/mismatching records,
explicit adjustments, duplicate retries, stale previews, invalid input, RLS and
foreign ownership, anonymous/inactive access, rollback after an injected history
failure, account/reset cascades, action validation, and rendered privacy masking.

Tests use isolated PGlite PostgreSQL, synthetic users, actual TypeScript source,
mocked service boundaries, and server rendering. They do not exercise concurrent
Supabase sessions, real Auth/PostgREST, or a live bank provider. Before release,
test the complete comparison flow through authenticated desktop/mobile browsers
in staging and use concurrent sessions to verify locking/retry behavior. The new
transaction trigger affects every ledger write; also test transfers, bill payment,
transaction deletion, account deletion, and tracking reset against Supabase.

Keep PR #3 in draft until the database and staging checks pass. No production
migration, live bank connection, merge, or production promotion was performed.
