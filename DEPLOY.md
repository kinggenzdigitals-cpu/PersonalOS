# Launch runbook — Life OS

Follow top to bottom. ~20–30 minutes. Order matters: **GitHub → Supabase →
Vercel → wire the production URL back**.

---

## 1) GitHub (push the code)

The repo is already committed locally. Create an **empty** GitHub repo (no
README/.gitignore) named `life-os`, then in this project folder run:

```bash
git remote add origin https://github.com/<your-username>/life-os.git
git branch -M main
git push -u origin main
```

If it asks you to authenticate, use a GitHub Personal Access Token or the
GitHub CLI (`gh auth login`).

---

## 2) Supabase (database + auth)

1. **Create a project** at https://supabase.com → New project.
   - Name: `life-os` · Region: **Southeast Asia (Singapore)** (closest to you).
   - Save the database password somewhere safe.

2. **Run every migration, in filename order.** Open **SQL Editor** → paste
   and **Run** each file's full contents from `supabase/migrations/`, one at a
   time, top to bottom (there is no `0022`):

   | File | What it adds |
   |---|---|
   | `0001_init.sql` | Core schema: profiles, accounts, categories, transactions, bills, budgets, habits, mood, tasks, calendar; balance view; signup trigger |
   | `0002_rls.sql` | Row Level Security on every core table |
   | `0003_ledger.sql` | Receivables & payables |
   | `0004_networth.sql` | Assets & liabilities |
   | `0005_savings_goals.sql` | Savings goals |
   | `0006_subscriptions.sql` | Subscriptions (plan + access status) |
   | `0007_focus_sessions.sql` | Focus (Pomodoro) sessions |
   | `0008_admin_feedback.sql` | Super admin role, feedback, admin audit log |
   | `0009_invitations.sql` | Complimentary-access invitations |
   | `0010_promotions.sql` | Promotional offers |
   | `0011_monthly_budgets.sql` | Overall monthly budget |
   | `0012_budget_extras.sql` | Budget carry-over, sinking-fund target dates |
   | `0013_security_hardening.sql` | RLS fixes: profile privilege escalation, cross-tenant references |
   | `0014_fast_entry.sql` | Merchant → category learning, transaction favorites |
   | `0015_dashboard_prefs.sql` | Dashboard card preferences |
   | `0016_billing_events.sql` | Payment webhook ledger (service-role only) |
   | `0017_subscription_lifecycle.sql` | Subscription lifecycle |
   | `0018_role_source.sql` | Admin grant source (provisional vs permanent) |
   | `0019_admin_tier_rls.sql` | Admin read/write split at the RLS layer |
   | `0020_csv_import.sql` | CSV / bank-statement import |
   | `0021_reconciliation.sql` | Bank reconciliation |
   | `0023_category_unique_name.sql` | One category name per user, per kind |
   | `0024_bill_kind.sql` | Incoming vs outgoing recurring bills |
   | `0025_promos_devices_subscriptions.sql` | Promo codes, device limits, subscription reporting |
   | `0026_launch_readiness.sql` | Synced preferences, habit scheduling, task projects & comments |
   | `0027_account_status_enforcement.sql` | Suspended/revoked accounts refused at the RLS layer |
   | `0028_audit_trail_and_data_rights.sql` | Admin audit trail survives account deletion; owners can delete their own feedback |
   | `0029_promo_code_integrity.sql` | Atomic promo redemption cap, redemptions survive deletion, redeem-attempt throttle |
   | `0030_feedback_write_bounds.sql` | Admins may only change feedback triage columns; https-only screenshot links |
   | `0031_trigger_function_grants.sql` | Trigger functions are not exposed as REST RPC endpoints |

   Each should finish with "Success. No rows returned." On an existing
   project, run only the files it doesn't have yet, still in order.

   From `0023` on, every file is safe to run twice, so re-running the newest
   one after a partial apply is fine (`npm run test:migrations`, i.e.
   `scripts/migrations-contract.test.cjs`, enforces this). Older files make no
   such promise: don't re-run them.

   **Supabase CLI instead:** `supabase db push` applies the same files on a
   fresh project. Don't switch a hand-pasted project to it without first
   marking the applied files with `supabase migration repair`, or it will try
   to run `0001` again.

3. **Enable Email auth.** Authentication → Providers → **Email** → enable.
   (Email confirmations on/off is your choice — see SMTP note below.)

4. **Get your keys.** Project Settings → **API**:
   - `Project URL` → this is `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / `publishable` key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → this is `SUPABASE_SERVICE_ROLE_KEY` (a secret: it
     bypasses RLS, so it only ever goes in server-side settings)

5. **Redirect URLs.** Authentication → URL Configuration → add:
   - `http://localhost:3000/**`
   - (add your Vercel URL here later, in step 4)

> **SMTP (recommended, not blocking):** the built-in Supabase email is limited
> to a few messages/hour — fine for testing, but password reset / confirmation
> will be flaky in real use. Connect a free SMTP (e.g. Resend) under
> Authentication → Emails when you're ready.

---

## 3) Vercel (deploy)

1. https://vercel.com → **Add New → Project** → import your `life-os` repo.
   It auto-detects Next.js — leave build settings default.

2. **Environment Variables** (Settings → Environment Variables). Add these for
   **Production** (and Preview). [`docs/ENVIRONMENT.md`](./docs/ENVIRONMENT.md)
   explains each one.

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL from step 2.4 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key from step 2.4 |
   | `NEXT_PUBLIC_SITE_URL` | leave blank for now, set in step 4 |
   | `SUPABASE_SERVICE_ROLE_KEY` | your `service_role` key from step 2.4. **Never** prefix it with `NEXT_PUBLIC_` |
   | `PAYMONGO_SECRET_KEY` | PayMongo dashboard → Developers → secret key (`sk_test_…` until the account is activated, then `sk_live_…`) |
   | `PAYMONGO_WEBHOOK_SECRET` | set in step 4, after registering the webhook |
   | `SUPER_ADMIN_EMAILS` | optional: comma-separated, confirmed owner emails |
   | `NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS` | optional: `true` only if your Vercel plan includes Speed Insights |

   Without the service-role key and both PayMongo values, checkout can't
   start and the payment webhook answers 503, so nobody's paid access is
   granted.

3. **Deploy.** You'll get a URL like `https://life-os-xxxx.vercel.app`.

> The app is pinned to the `sin1` (Singapore) region via `vercel.json`, next to
> your database — no action needed.

---

## 4) Wire the production URL back (important)

1. In **Vercel** → env vars, set `NEXT_PUBLIC_SITE_URL` to your live URL
   (e.g. `https://life-os-xxxx.vercel.app`) → **Redeploy**.

2. In **Supabase** → Authentication → URL Configuration:
   - Set **Site URL** to your live URL.
   - Add `https://life-os-xxxx.vercel.app/**` to redirect URLs.

3. In **PayMongo** → Developers → Webhooks, register
   `https://<your-domain>/api/webhooks/paymongo` for the
   `checkout_session.payment.paid` event. Copy that webhook's secret into
   Vercel as `PAYMONGO_WEBHOOK_SECRET` → **Redeploy**.

4. **Preflight.** Pull the production env to a throwaway file and check that
   nothing is missing or still a placeholder:

   ```bash
   vercel env pull .env.preflight --environment=production
   npm run launch:preflight -- .env.preflight
   rm .env.preflight
   ```

   Never pull production into `.env.local` — local `npm run dev` and the e2e
   tests read that file, so your machine would then run against the production
   database with the live service-role and PayMongo keys.

---

## 5) Verify

- [ ] Open the live URL → the **landing page** shows.
- [ ] `https://<your-domain>/api/health` answers `{"ok":true}`. Point your
      uptime monitor here, not at `/` (see `docs/DISASTER_RECOVERY.md`).
- [ ] **Sign up** → land on onboarding → add a name + accounts → dashboard.
- [ ] **Add an expense** → balance + "spent today" update.
- [ ] Sign out, sign in again → data persists.
- [ ] (Optional) Sign up a **second** account → it sees none of the first's
      data (RLS working).
- [ ] In PayMongo **test mode**, buy a plan → paid access is granted and
      `billing_events` gets a `PAID` row. The full billing checks are in
      `docs/LAUNCH_CHECKLIST.md` → Billing.

If a deploy breaks production, follow **Deployment rollback** in
`docs/DISASTER_RECOVERY.md`.

---

## Appendix — Google sign-in (optional)

The "Continue with Google" button needs a Google Cloud OAuth client:

1. https://console.cloud.google.com → new project → APIs & Services →
   **OAuth consent screen** (External) → fill basics.
2. **Credentials → Create OAuth client ID → Web application.**
   - Authorized redirect URI:
     `https://<your-ref>.supabase.co/auth/v1/callback`
3. Copy the **Client ID + Secret** into Supabase → Authentication → Providers →
   **Google** → enable + paste.

Until this is done, **email + password sign-in works fine** — Google is a bonus.
