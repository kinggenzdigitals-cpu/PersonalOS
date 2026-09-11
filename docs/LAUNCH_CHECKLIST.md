# Launch checklist

## Vercel and domain

- Link the production Vercel project to the correct Git repository.
- Add the custom domain in Vercel and set `NEXT_PUBLIC_SITE_URL` to the final `https://` URL.
- Enable Vercel Web Analytics for the project. The app already renders `@vercel/analytics` in the root layout.
- Enable Speed Insights/performance monitoring only when the selected plan supports it, then set `NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS=true`.
- Review the current Vercel Hobby plan before collecting payments. A paid finance product should use a plan that provides the needed observability, support, team access, deployment controls, and commercial-use limits for the owner’s launch risk.

## Supabase

- Apply every migration in `supabase/migrations` through `0026_launch_readiness.sql`.
- Confirm Google auth is enabled and the production callback URL points to `/auth/callback` on the final domain.
- Enable Supabase Auth identity linking/manual linking if you want existing email/password users to connect Google from Account Settings.
- Confirm RLS is enabled on owner data tables.
- Store `SUPABASE_SERVICE_ROLE_KEY` only in server-side environments and GitHub Actions secrets.
- Run `npm run launch:preflight` after environment variables are configured.

## Billing

- Confirm Xendit API credentials and webhook token are set in production.
- Confirm Xendit sends callbacks to `/api/xendit/webhook` on the final domain.
- Test successful payment, canceled checkout, duplicate webhook, invalid webhook token, delayed webhook, and missing-service-role behavior.
- Confirm no normal subscription auto-charge happens after promo/free-invite access unless the user explicitly consented to renewal.

## Product readiness

- Verify sign-up, Google login, logout/login, account deletion, CSV import, payment activation, promo redemption, device limit, app install, and app lock flows on desktop and mobile.
- Run keyboard-only checks for dialogs, menus, transaction controls, the habit grid, and account settings.
- Confirm charts expose accessible summaries or equivalent tables.
- Confirm reduced-motion behavior and mobile touch target sizes.
- Replace any unlicensed assets before publishing.

## Legal and owner review

Before charging a broad public audience, owner or counsel should approve business identity/support details, retention and account-deletion timelines, payment/cancellation/refund terms, processor disclosures, breach response, admin access rules, payment record retention, and third-party notices.
