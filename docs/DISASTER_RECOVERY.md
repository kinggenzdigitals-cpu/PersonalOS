# Backup restoration and disaster-recovery drill

Run this drill before launch and repeat after major schema changes.

1. Export a Supabase database backup from production or a production-like staging project.
2. Restore it into a separate staging Supabase project.
3. Configure a staging `.env.local` or Vercel preview environment with the staging project URL, anon key, and service-role key.
4. Run migrations against staging and confirm they are idempotent for already-applied objects.
5. Sign in as a test user and verify Money, Habits, Focus, Tasks, Calendar, Billing, account deletion, and backup download flows.
6. Replay sample Xendit webhook payloads in staging for duplicate, invalid-token, delayed, and missing-configuration cases.
7. Record restore start time, finish time, database size, errors, and manual steps needed.
8. Update this document and the launch checklist if any manual step is still required.

Keep production credentials out of screenshots, logs, issue comments, and support tickets.
