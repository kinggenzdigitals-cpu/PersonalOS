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

2. **Run the migrations in order.** Open **SQL Editor** → paste and **Run**
   each file's full contents, in this exact order:
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_rls.sql`
   3. `supabase/migrations/0003_ledger.sql`
   4. `supabase/migrations/0004_networth.sql` (assets & liabilities)
   5. `supabase/migrations/0005_savings_goals.sql` (savings goals)

   Each should finish with "Success. No rows returned." If your project was
   created before these existed, just run the missing ones (0004, 0005) now.

3. **Enable Email auth.** Authentication → Providers → **Email** → enable.
   (Email confirmations on/off is your choice — see SMTP note below.)

4. **Get your keys.** Project Settings → **API**:
   - `Project URL` → this is `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / `publishable` key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

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

2. **Environment Variables** (Settings → Environment Variables), add all three
   for **Production** (and Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL from step 2.4 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key from step 2.4 |
   | `NEXT_PUBLIC_SITE_URL` | leave blank for now, set in step 4 |

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

---

## 5) Verify

- [ ] Open the live URL → the **landing page** shows.
- [ ] **Sign up** → land on onboarding → add a name + accounts → dashboard.
- [ ] **Add an expense** → balance + "spent today" update.
- [ ] Sign out, sign in again → data persists.
- [ ] (Optional) Sign up a **second** account → it sees none of the first's
      data (RLS working).

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
