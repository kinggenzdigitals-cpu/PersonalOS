# Backup restoration and disaster-recovery drill

Run this drill before launch and repeat after major schema changes.

1. Export a Supabase database backup from production or a production-like staging project.
2. Restore it into a separate staging Supabase project.
3. Configure a staging `.env.local` or Vercel preview environment with the staging project URL, anon key, and service-role key.
4. Run migrations against staging and confirm they are idempotent for already-applied objects.
5. Sign in as a test user and verify Money, Habits, Focus, Tasks, Calendar, Billing, account deletion, and backup download flows.
6. Replay sample PayMongo webhook events in staging for duplicate, invalid-signature, amount-mismatch, delayed, and missing-configuration cases.
7. Record restore start time, finish time, database size, errors, and manual steps needed.
8. Update this document and the launch checklist if any manual step is still required.

Keep production credentials out of screenshots, logs, issue comments, and support tickets.

## Deployment rollback

Use this when a production deploy breaks the app. The code rolls back in seconds. The database does not roll back at all.

1. **Roll back the app.** Vercel → Project → Deployments → the last good production deployment → **Instant Rollback**, or `vercel rollback <deployment-url>`. Nothing is rebuilt. On Hobby you can only go back to the previous production deployment; picking an older one needs Pro or Enterprise.
2. **Check that later deploys go live.** After a rollback, confirm that the fix you push next is actually serving production. If it isn't, promote it: Deployments → **Promote**, or `vercel promote <deployment-url>`.
3. **Leave the database alone.** Migrations only go forward (there are no down files) and they are additive: new tables, `add column if not exists`, replaced functions and policies. The previous build keeps working against the newer schema. Don't hand-edit the schema or re-run old migrations to "undo" one.
4. **Fix a bad migration by going forward.** Write the next-numbered migration that corrects it, re-runnable like the rest (`npm run test:migrations` checks this), apply it, and ship it with the code fix. Never edit a file that has already been applied, because environments that already ran it will never see the change. If data was destroyed, restore from backup with the drill above, into a staging project first.
5. **Confirm recovery.** `https://<domain>/api/health` returns 200 `{"ok":true}`; it answers 503 while the database can't be reached. Then walk the checks in `DEPLOY.md` → Verify.

## Monitoring

Point an external uptime monitor at `https://<domain>/api/health`, not `/`. The landing page still returns 200 when Supabase is down or paused, because it swallows its own database errors. `/api/health` makes one database round-trip and answers 503 when that fails. Choosing the monitor and its alert channel is the owner's call: nothing in this repo pages anyone.

Every server error is written to Vercel Runtime Logs as one JSON line with `"event":"request_error"`, tagged with the digest users see as "Reference: …" on the error page. Search the logs for that digest to find the failing route. Headers, cookies and query strings are never logged. Forwarding these lines to an outside service (a log drain or an error tracker) makes that service a data processor, so update the privacy page before turning one on.
