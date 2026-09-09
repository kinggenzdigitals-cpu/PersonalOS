# Compliance & Risk Audit — Finance & Habit Tracker

**Audit date:** 2026-09-08
**Scope:** repository at commit `8f26176` + live deployment `https://financialhabittracker.vercel.app`
**Supabase project:** `gumffumhyxjljsxuztip` (region `ap-southeast-1`, Singapore)

---

## 0. Limitations — read this first

**This is a technical audit produced by an AI assistant. It is not legal advice, and it does
not establish compliance with any law.** Nothing here should be relied on as a legal opinion.
A qualified Philippine lawyer must review every item marked **LAWYER**.

What was **not** testable, and why:

| Not tested | Reason |
|---|---|
| Authenticated UI (all `(app)` routes) | Auth-gated; the auditor had no credentials and did not sign in. Protected-route findings come from **source reading**, not from loading the pages. |
| Accessibility (WCAG 2.2 AA) | **PARTIALLY AUDITED — see §11.** Public routes scanned with axe-core 4.10.2; auth-gated routes source-reviewed only. Automated scanning cannot establish conformance. |
| Full security-posture sweep | **PARTIAL.** The dedicated security agent also terminated early. Security findings below come from the third-party, storage and data lenses only. |
| Supabase backup / PITR window | Not readable from the repo or via available tooling. Must be read off the Supabase dashboard. |
| Unsplash per-photo licence tier | `images.unsplash.com` returns bytes with no attribution metadata. |
| Owner business registration | Nothing in repo, database or live site references any. **Not invented.** |

No accessibility conformance is claimed. Automated tooling detects only a fraction of WCAG
issues, and the authenticated app was never loaded — see §11 for exactly what was and was not
tested.

---

## 1. Verified good news (recorded because absence of evidence *is* the finding)

These were proven by exhaustive negative greps, not assumed:

| Finding | Evidence |
|---|---|
| **Zero analytics, ad pixels, session replay or error tracking** | Grep for `sentry\|posthog\|mixpanel\|amplitude\|hotjar\|clarity.ms\|fullstory\|logrocket\|datadog\|bugsnag\|newrelic\|plausible\|umami\|matomo\|googletagmanager\|google-analytics\|gtag(\|fbq(\|@vercel/analytics` across `src/` and `public/` → **0 matches**. `npm ls --omit=dev --depth=0` → no telemetry SDK. Live HTML → no `_vercel/insights`. |
| **Anonymous visitors receive no cookies at all** | `curl -s -D -` on `/` returns **no `Set-Cookie` header**. |
| **Google Fonts are self-hosted** | `next/font/google` downloads at build time; `grep -rl 'fonts.gstatic.com\|fonts.googleapis.com' .next` → **0 files**. No visitor IP reaches Google. |
| **Unsplash never sees the visitor** | `next/image` proxies server-side; live HTML has **0** `<img src="https://images.unsplash...">`. Vercel's optimiser fetches, not the browser. |
| **All 27 public tables have RLS enabled** | Live `pg_class.relrowsecurity` = true on all 27; 24 owner-scoped on `auth.uid() = user_id`. |
| **No fake testimonials, reviews, ratings or user counts** | Grep for `testimonial\|review\|rating\|star\|trustpilot\|as seen (on\|in)\|featured in\|endorse\|award` → no marketing hits. |

### 1.1 Cookie banner verdict: **NOT required — but disclosure is**

Every storage item is **strictly necessary** (Supabase auth session) or **preference**
(theme, privacy mask, focus timer, last-used account). There is no analytics, no advertising,
no third-party cookie, and no cookie at all before sign-in.

The DPA contains no cookie-specific consent rule — there is no Philippine equivalent of EU
ePrivacy Art. 5(3), which is what actually mandates "accept cookies" modals in Europe. **A
banner here would be theatre, and a consent prompt nobody needs is itself a dark pattern.**

What *is* unmet is the **transparency duty** under RA 10173 §16(a)–(b): the Privacy Policy
discloses **zero** cookies and **zero** browser storage (`grep -niE "cookie|localstorage|
browser storage|tracking|analytic|session" src/app/privacy/page.tsx` → **0 hits**).

**LAWYER** — confirm this reading of NPC Circular 2023-04 before relying on it.

---

## 2. Critical

### C-01 — Privacy Policy promises account deletion that does not exist
- **Evidence:** `src/app/privacy/page.tsx:55` — *"Delete your data or your entire account at any time."* The only deletion control is `deleteAllData()` (`src/app/(app)/settings/actions.ts:144`), whose own docstring says the login is kept. `grep -rn "deleteUser\|auth.admin.delete" src/` → **0 hits**. `auth.users` is never touched.
- **Legal area:** RA 10173 §16(e) right to erasure; RA 7394 misrepresentation.
- **Fix:** Either build real deletion (server action under re-authentication calling `admin.auth.admin.deleteUser(userId)` so `ON DELETE CASCADE` fires), or correct the sentence to describe what actually happens.
- **Status:** **FIXED** — `deleteAccount()` added in `src/app/(app)/settings/actions.ts`, exposed in Settings → Danger zone, confirmed by typing the account email. It scrubs the PII that `on delete set null` would otherwise strand (`admin_audit_log.detail`, the user id embedded in `billing_events.external_id`, the user's own `user_invitations` row) and then calls `admin.auth.admin.deleteUser()`, which cascades the 25 owner-scoped tables. Owner-allowlisted addresses are refused — deleting one would destroy the data and hand super admin back on the next sign-in. Payment rows are deliberately retained with identifiers redacted. **LAWYER** should confirm the retention stance and the redaction approach.

### C-02 — Landing page advertises "unlimited" against enforced hard caps
- **Evidence:** `src/app/page.tsx:248` and `:43` — *"unlimited accounts, goals, net worth, and CSV export."* Pro is capped at **8 accounts / 5 goals / 15 habits**, enforced server-side. Confirmed live.
- **Legal area:** RA 7394 (Consumer Act) misleading advertising; RA 11967 product-description duties.
- **Fix:** Replace with the real numbers at `src/app/page.tsx:43`, `:248`, `src/app/(app)/account/page.tsx:158`.
- **Status:** **FIXED** in `68e54c7`. The copy now interpolates `PLANS.pro.limits` directly, so it cannot drift from the enforced cap again. **LAWYER** should still review the historical exposure.

---

## 3. High

### H-01 — Four public statements promise automatic renewal that cannot occur
`src/components/marketing/pricing-cards.tsx:58,126`, `src/app/terms/page.tsx:47`,
`src/app/pricing/page.tsx:22` all assert auto-renewal. Billing is **one-off Xendit invoices,
no stored card** — `supabase/migrations/0017` says so explicitly. RA 11967 renewal-disclosure;
RA 7394. **OWNER DECISION + LAWYER.**

### H-02 — No business-identity disclosure anywhere on the site
Grep for `DTI|SEC|BIR|TIN|registered business|business permit|\+63|Data Protection Officer|
DPO|NPC` → **zero** business-disclosure hits. RA 11967 (Internet Transactions Act) online-merchant
disclosure; RA 8792. See §8 for the owner deliverable list. **OWNER + LAWYER.**

### H-03 ✅ FIXED — Signup collects an account under a false privacy line, with no policy links
`src/app/(auth)/signup/page.tsx:41-43` is the *entire* legal text at account creation:
*"By continuing you agree to keep your data yours. We never share it."* Data **is** shared with
Supabase, Vercel and Xendit. No link to `/terms` or `/privacy`. RA 10173 transparency; RA 8792
electronic contract formation. **LAWYER.**
**Status:** The false "we never share it" line is replaced with an accurate notice linking
both documents, using different verbs deliberately — Terms are *agreed to*, the Privacy
Policy is a *notice*, because consent is the wrong lawful basis for a privacy notice.
Policy links were also added to Settings, since a signed-in user never sees the marketing
footer that previously carried the only in-app links. **Still outstanding:** the brief's
required unchecked Terms checkbox with recorded version/timestamp/user-id — that needs a
schema change and has not been built.

### H-04 — Privacy Policy omits Xendit, Vercel, Singapore, retention, DPO and the NPC route
`src/app/privacy/page.tsx` names exactly one third party ("Supabase"). Missing: Xendit
(receives **email address + raw Supabase user UUID**, `src/app/(app)/settings/billing-actions.ts:54-68`),
Vercel (terminates TLS, runs every Server Action, `X-Vercel-Id: sin1`), cross-border transfer,
any retention period, a DPO, and the NPC complaint route. RA 10173 + IRR. **OWNER + LAWYER.**

### H-05 — IP addresses and user agents are collected and stored, undisclosed
Live: `select count(*), count(user_agent), count(ip) from auth.sessions` → **total=2,
with_user_agent=2, with_ip=2**. Held by Supabase in Singapore. The Privacy Policy never mentions
IP, user agent or session records. RA 10173 §16. **LAWYER.**

### H-06 — All personal and financial data is stored outside the Philippines
Supabase `region: ap-southeast-1` (Singapore); `vercel.json` pins `"regions":["sin1"]`. The
cross-border transfer is not disclosed. RA 10173 cross-border/outsourcing. **LAWYER.**

### H-07 — `mood_entries` stores likely-sensitive personal information
`supabase/migrations/0001_init.sql:269-284` — `prayer_requests` (religious belief),
`journal`, and self-reported `mood`/`energy`/`stress` (health). Held under ordinary RLS with
no specific disclosure or heightened treatment. RA 10173 **§3(l) sensitive personal information**
carries stricter consent rules. **LAWYER — this is the single most consequential legal question
in this audit.**

### H-08 — No retention mechanism of any kind exists
`grep -rniE "cron|retention|purge|cleanup|anonymi[sz]e|auto.?delete"` → one unrelated comment.
`pg_extension` → no `pg_cron`. `vercel.json` → no `crons` key. Nothing is ever purged.
RA 10173 §11(e). **A policy stating a retention period would be unenforceable without building
the purge first.** **OWNER + LAWYER.**

### H-09 ✅ FIXED — "Delete all data" leaves eight tables of personal data behind
**Status:** **FIXED** — `import_batches` added to the reset list, placed before `accounts` so both SET NULL foreign keys resolve children-first. Still kept, each on purpose: `profiles` and `categories` (a reset keeps the login, and categories are seeded only at signup, so wiping them would leave onboarding with none); `subscriptions` / `promotion_offers` / `billing_events` (a data reset must not strip access the user has paid for, and `billing_events` is service-role-only regardless); `user_invitations` / `admin_audit_log` (not owner-deletable under RLS — `deleteAccount()` handles them via the admin client).
`src/app/(app)/settings/actions.ts:153-173` deletes 19 tables. Not deleted: `profiles`
(display_name, username, last_login_at, timezone survive), `categories`, `import_batches`
(**holds uploaded bank-statement filenames**), `subscriptions`, `promotion_offers`,
`billing_events`, `user_invitations`, `admin_audit_log`. **OWNER.**

### H-10 — `admin_audit_log` holds user email addresses with no data-subject access
Single policy `is_super_admin()` SELECT. Emails written into `detail jsonb`. The data subject
can neither see, export, nor delete their own entries. RA 10173 access/erasure rights.
**OWNER + LAWYER.**

### H-11 — The "three-active-device limit" does not exist
Exhaustive grep across `.ts/.tsx/.sql/.md/.json` → **zero hits**. **The Terms must not mention
it.** If wanted, it must be built first. **OWNER.**

### H-12 ✅ FIXED (`4f6ab94`) — 13 production vulnerabilities; 10 traced to a misplaced build tool
`npm audit --omit=dev` → **0 critical, 10 high, 3 moderate, 461 prod deps**. Ten stem from
`shadcn@4.13.1` sitting in `dependencies` — a CLI no application code imports
(`grep "from 'shadcn'" src scripts` → 0 hits) that drags in an MCP server, `express` and
`dotenvx`. The `next` advisories (incl. SSRF in rewrites) touch the deployed runtime.
**Fix: move `shadcn` to `devDependencies`; evaluate `next` 16.2.10 → 16.3.4.**

### H-13 — Session cookie is not `httpOnly` and lasts 400 days
`@supabase/ssr` `DEFAULT_COOKIE_OPTIONS` = `{ httpOnly: false, maxAge: 400 days }`, and neither
`src/lib/supabase/server.ts` nor `middleware.ts` overrides it. Also no `Secure` attribute.
RA 10173 §20. *(Note: `httpOnly` cannot simply be flipped — the browser client reads the cookie
via `document.cookie`.)*

### H-14 — Watermarked PNGTree comp file in the repo root
`pngtree-shiny-3d-gold-dollar-sign-...png` (2500×2500, 832,778 B). Rendered thumbnail confirms
it is **overprinted with tiled "pngtree" watermark text and the PNGTree logo** — i.e. an
unlicensed comp, not a purchased asset. Nothing references it; it is **not** deployed.
**File left untouched.** **OWNER: produce the licence/receipt, or delete it.**

### H-15 ✅ FIXED (`1249b14`) — No security response headers on any route
No `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` or
`X-Content-Type-Options`. `next.config.ts` has no `headers()`. HSTS is present (Vercel default).

---

## 4. Medium

| ID | Issue | Where |
|---|---|---|
| M-01 | Terms missing governing law, refund policy, suspension/termination, and the Premium tier they sell | `src/app/terms/page.tsx` |
| M-02 | `/pricing` FAQ describes a "read-only" downgrade mode that does not exist in code | `src/app/pricing/page.tsx:26` |
| M-03 | Landing page says "Sign up with email or Google" while the provider is disabled | `src/app/page.tsx:213` |
| M-04 | The "12-minute offer" countdown can be re-claimed indefinitely — false urgency | `promo-actions.ts:32-46` |
| M-05 | `ledger_entries.party` stores identifiable **non-user third parties** who never consented | `0003_ledger.sql:14` |
| M-06 | `billing_events` RLS on, **zero policies** — users cannot see their own payment history | `0016_billing_events.sql:33` |
| M-07 | `user_invitations` retains invitee email + full name indefinitely | `0009_invitations.sql:11-12` |
| M-08 ✅ | Internal `admin_note` on feedback leaks back to the user via JSON export | `settings/actions.ts:124` | fixed in `1249b14` |
| M-09 ✅ | Data export omits 4 tables and the account email — not a complete copy | `settings/actions.ts:75-99` | fixed — `import_batches` and the account email + created_at now included. Still excluded on purpose: `billing_events` (no owner policy, see M-06), `user_invitations` (carries `token_hash`), `admin_audit_log` (admin-only). |
| M-10 ✅ | Unguarded `localStorage` read in an app-wide provider blanks the whole site where site data is blocked | `theme-customizer.tsx:34-38` | fixed in `1249b14` |
| M-11 ✅ | Middleware discards refreshed/cleared auth cookies on redirect responses | `middleware.ts:64-76` | fixed in `1249b14` |
| M-12 | Two `localStorage` keys measure engagement to trigger an upsell — the only non-necessary/non-preference items | `active-use-timer.tsx:6-8` |
| M-13 | Google's "G" trademark is **hand-redrawn** rather than Google's official asset | `google-button.tsx:60-84` |
| M-14 | No credits/attribution page, while the bundle carries ISC, MIT, Apache-2.0 and OFL notice obligations | no such route exists |
| M-15 | Four Unsplash photos hotlinked with no provenance record kept | `src/app/page.tsx:51-58` |
| M-16 ✅ | OpenGraph share image unreachable in production (blocked by the proxy matcher) | `src/proxy.ts:15` | fixed — next/og routes have no file extension, so the matcher's image escape never caught them |

---

## 5. Low / Info

- **L-01 ✅ FIXED (`1249b14`)** `/invite/[token]` renders a third party's **email address** to any unauthenticated holder of the link; no `noindex`. (`invite/[token]/page.tsx:60-62`)
- **L-02 ✅ FIXED (`1249b14`)** `/subscription` files the visual "Hide sensitive info" mask under a heading called **"Security"**. It is a CSS mask, not security. (`plan-features.ts:127-131`)
- **L-03 ✅ FIXED (`1249b14`)** Marketing header/footer render the logo letter **"L"** while the product is "Finance & Habit Tracker".
- **L-04 ✅ FIXED (`1249b14`)** `next.config.ts` allow-lists two unused `picsum.photos` hosts — a needless open image proxy.
- **L-05** Sessions have no absolute expiry (`not_after` null on both live rows); sign-out leaves per-device state in `localStorage`, including account/task/habit UUIDs.
- **L-06** Super admins can read every user's email, plan and last-login, plus all feedback text — undisclosed.
- **L-07** Supabase advisors: leaked-password protection **off**; three `SECURITY DEFINER` helpers callable via RPC by `anon`.
- **Info** App icons appear to be original in-repo work (colours match `src/app/icon.svg` exactly) — owner should record authorship in one line.
- **Info** Fonts (Fraunces, Karla) verified **SIL OFL 1.1** — commercial use clear. `lucide-react` verified **ISC + embedded MIT** — clear.
- **Info** No video, audio or embedded media exists anywhere. The entire copyright surface is six files.

---

## 6. Registration & governance assessment

Every row here is **LAWYER** — the evidence supports the question, not the answer.

| Requirement | What the evidence shows |
|---|---|
| Designated **DPO** | None named anywhere. Processing includes financial records and likely-sensitive data (H-07). |
| **NPC registration** of the Data Processing System | Not addressed anywhere. Turns on scale/sensitivity thresholds — needs counsel. |
| Exemption declaration | Not assessed. |
| **Privacy Impact Assessment** | No PIA exists in the repo. |
| **Vendor data-processing agreements** | No DPA with Supabase, Vercel or Xendit is recorded in the repo. |
| **Cross-border transfer safeguards** | Transfer to Singapore is real and undisclosed (H-06). No safeguard documented. |
| **Breach-response plan** | **None exists in the repo.** RA 10173 imposes breach-notification duties. |
| **DTI / SEC registration** | Not disclosed; existence unknown. |
| **BIR registration + compliant invoices** | Not addressed. Xendit issues payment records, not BIR-compliant invoices. |
| **LGU business permit** | Not addressed. |
| **PH Trustmark / Online Business Database** | Not addressed. RA 11967 IRR. |

**Nothing has been submitted, registered or declared. No filings were made.**

---

## 7. Third-party inventory (verified)

| Provider | Data shared | Purpose | Location | Browser storage | Leaves PH |
|---|---|---|---|---|---|
| **Supabase** | All auth + financial + habit + mood data; IP + user-agent in `auth.sessions` | Database, auth | **Singapore** (`ap-southeast-1`) | `sb-<ref>-auth-token` (first-party, chunked) | **Yes** |
| **Vercel** | Every request; TLS termination; all Server Actions | Hosting, image proxy | **Singapore** compute (`sin1`), global edge, US company | none | **Yes** |
| **Xendit** | **Email address + raw Supabase user UUID**, plan, amount, currency | Payments | Not verified | none (redirect to their domain) | **Yes** |
| **Unsplash** | Server IP + image path only — **not the visitor's IP** | Landing images | US | none | Server-side only |
| **Google (OAuth)** | Configured in code; **provider currently disabled** | Optional sign-in | US | none while disabled | n/a currently |

**Browser storage, complete:** Supabase auth cookie (chunked) + seven `localStorage` keys
(`fht-theme`, `fht-privacy`, `fht-focus`, `fht-active-seconds`, `fht-upgrade-shown`,
`lifeos:lastAccount`; `fht-color-mode` is declared but **never written**) + one Cache Storage
bucket (`life-os-v2`, public build artifacts only). **No sessionStorage, no IndexedDB, no
third-party cookies.**

---

## 8. OWNER MUST PROVIDE (nothing here was invented)

Legal pages cannot be published until these exist:

1. Registered business name
2. Trade name, if different
3. Business registration number (DTI sole prop / SEC)
4. Registered physical business address
5. Customer-support email address
6. Contact phone number (mobile or landline)
7. Complaint / redress channel
8. **DPO name and contact** (or documented reason none is required)
9. **Retention periods** — active account, post-closure, audit log, invitations
10. Supabase **backup / PITR window** (read from the dashboard)
11. **Refund window and terms** — or an explicit, pre-purchase-disclosed stance
12. Whether a **free trial** genuinely exists
13. Governing law and venue
14. Suspension/termination grounds and notice period
15. PNGTree licence receipt for the root PNG — or a decision to delete it
16. Unsplash per-photo provenance (photographer, licence tier, date retrieved)
17. App-icon authorship (one line)
18. Whether the **auto-renewal** language or the **invoice-based** implementation is the intended model
19. Whether a **device limit** should be built (it currently does not exist)

---

## 9. Implementation status

Fixes landed in three commits after the audit was first written:

| Commit | Items |
|---|---|
| `4f6ab94` | H-12 — `shadcn` moved out of production deps: 461 → 150 prod deps, 13 → 4 vulnerabilities |
| `68e54c7` | C-02, M-02, M-03 — false public claims corrected against real `PLANS` limits; the absolute "no other user can ever see your data" guarantee replaced with what is actually true |
| `1249b14` | H-15, M-08, M-10, M-11, L-01, L-02, L-03, L-04 — security headers, export column allow-list, guarded storage reads, auth-cookie preservation on redirects, invite `noindex`, dead image allowlist removed |
| *(this pass)* | A11Y-01, A11Y-02, A11Y-03 — see §11 |

Everything above was verified with `tsc`, `lint`, the 241-assertion suite and a production
build; the security headers and the axe re-scan were confirmed against a running server rather
than asserted from config.

**No legal pages were drafted or published.** That was deliberate: an accurate Privacy Policy
requires items 1–10 above, and publishing a policy containing placeholders would be worse than
publishing none.

---

## 11. Accessibility (WCAG 2.2 Level AA)

**Method:** axe-core 4.10.2 executed in-page against the live public routes
(`/`, `/login`, `/pricing`) with rulesets `wcag2a, wcag2aa, wcag21a, wcag21aa,
wcag22a, wcag22aa`. Auth-gated routes could not be loaded and were source-reviewed.

**No conformance claim is made.** Automated tooling detects roughly a third of WCAG
issues; the manual checks below were partial, and a full audit needs screen-reader
testing and keyboard walkthroughs of the authenticated app.

### Found and FIXED

| ID | Issue | SC | Evidence |
|---|---|---|---|
| A11Y-01 | `maximumScale: 1` disabled pinch-zoom on every page | **1.4.4 Resize Text** (AA) | axe `meta-viewport`, impact **critical**, on `/`, `/login`, `/pricing`. Fixed by removing `maximumScale` from `src/app/layout.tsx`. |
| A11Y-02 | White on `--brand` measured **2.73:1**; hover `#7cb2ff` **2.17:1** — against a 4.5:1 floor | **1.4.3 Contrast** (AA) | axe `color-contrast`, impact **serious**, 4 nodes on `/`, 3 on `/pricing` — the primary CTAs. Root cause: dark mode lifts `--brand` to a light blue so it reads as *text* on the dark ground, but the same token is also a button *background*, where a light fill needs dark ink. Fixed with a dedicated `--brand-foreground` (`#ffffff` light / `#04122e` dark) applied to 27 lines across 19 files → **6.81:1**, hover **8.55:1**. |
| A11Y-03 | No skip-to-content link anywhere | **2.4.1 Bypass Blocks** (A) | `grep` for skip-link patterns returned zero. The sidebar places ~12 nav links before `<main>`, so keyboard users traverse them on every page. Added to `(app)/layout.tsx`; `<main>` given `id="main-content"` and `tabIndex={-1}` so focus lands. |

**Re-scan after fixes:** `/` → **0 violations** (26 passes, was 25 with 2 violations).
`/pricing` → **0 violations** (25 passes). Verified on a running build, not asserted.

### Found, NOT fixed — needs a design decision

| ID | Issue | Why not auto-fixed |
|---|---|---|
| A11Y-04 | White on `--primary` `#2f7dff` = **3.82:1** (below the 4.5:1 text floor) | `bg-primary` backs shadcn primitives — button default, badge, checkbox, slider and the **switch thumb** (`dark:data-checked:bg-primary-foreground`). Darkening `--primary-foreground` to `#04122e` reaches 4.86:1 but turns the switch thumb dark navy, a visible control change. Note **1.4.11 Non-text Contrast** requires only 3:1 for UI components, which 3.82 already meets — so only the *text* uses (button, badge) fail. **OWNER DECISION.** |

### NOT tested — honest gaps

- Every authenticated route (`/home`, `/money/*`, `/habits`, `/settings`, `/admin`) — no credentials
- The skip link could not be exercised live; it sits in the auth-gated layout, so only its markup was verified
- Screen-reader behaviour (NVDA/JAWS/VoiceOver) — not run
- Full keyboard walkthrough of dialogs, focus trapping and focus restoration
- Reduced-motion preferences
- Touch-target sizing across the authenticated app
- Financial charts and table semantics (`budget-vs-actual.tsx`, `trend-chart.tsx`, `category-donut.tsx`)

## 10. Remaining unverified

- Accessibility conformance — **not audited at all** (agent terminated early)
- Full security sweep — partial only
- Owner-side registrations (DTI/SEC/BIR/LGU) — existence unknown
- Supabase backup/PITR retention window
- Unsplash per-photo licence tier and photographer
- Whether the owner holds any PNGTree licence
- Live `Set-Cookie` confirmation of the auth cookie name (requires an authenticated session; the auditor did not sign in)
- Vercel edge/CDN points of presence actually serving this deployment
- Whether the "Last updated July 2026" dates on `/privacy` and `/terms` reflect real review dates
