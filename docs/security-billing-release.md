# Security, Admin, and Billing Release Checklist

This work is code-complete on the feature branch. Do not merge or deploy it
until migrations 0011 and 0012 pass on a Supabase staging branch or separate
test project.

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
| ❌ | Verify service-role configuration in staging and production |
| ❌ | Apply and verify migrations 0011 and 0012 in staging |
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
| ❌ | Run a full Xendit sandbox checkout and callback test |
| ❌ | Build and test free-trial and promo-code redemption |
| ❌ | Have final terms and privacy wording reviewed by a qualified Philippine lawyer |
| ❌ | Build Android and iOS store versions later |

## Required staging checks

| Step | Check |
| --- | --- |
| 1 | Create or select a non-production Supabase project/branch and take a backup. |
| 2 | Apply migrations 0011 and 0012 in order. Do not rewrite an already-applied migration. |
| 3 | Sign in with two synthetic users and verify neither can read the other's records. |
| 4 | Test JSON export, tracking reset, recent-login account deletion, and admin system status. |
| 5 | Use Xendit sandbox to test correct payment, wrong amount, duplicate callback, and retry after a temporary database error. |
| 6 | Merge and deploy only after all staging checks pass. |

Automated coverage currently passes 25 focused tests, including the isolated
PostgreSQL migrations, RLS isolation, atomic payment completion, duplicate
callbacks, pricing totals, monthly budget calculations, and data-reset scope.
This does not replace staging tests against Supabase Auth/PostgREST or Xendit.
