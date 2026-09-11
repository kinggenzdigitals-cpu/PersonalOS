# Authentication operations

## Google account switching

The Google sign-in button sends Supabase OAuth with Google `prompt=select_account`. Google should show the account chooser every time a user clicks Continue with Google, allowing another Google account to be selected or added.

## One account, multiple sign-in methods

A Finance & Habit Tracker account is keyed by the Supabase `auth.users.id`; all profiles, subscriptions, transactions, habits, settings, and device records reference that ID.

For a Google-first user who later wants email/password login, do not use or request the Gmail password. The user should sign in with Google, open Account, then choose Set or change password. Supabase updates the password on the same signed-in user, so future email/password login opens the same app data.

For an email/password user who wants Google login, the user should sign in with email/password, open Account, and choose Connect Google to this account. Supabase `linkIdentity()` starts a Google OAuth flow and attaches the Google identity to the current signed-in user when the provider confirms it.

## Existing duplicate users

Do not merge accounts based only on matching text email addresses. A safe review requires confirmed/verified emails and a provider-supported identity link or an explicit data-migration plan.

Run this from a secure admin machine with a service-role key to find duplicate verified-email groups:

```bash
npm run auth:audit
```

The audit does not print passwords or tokens. It reports user IDs, verification state, provider names, and creation dates so the owner can decide whether a supported identity-link flow or a deliberate migration is needed.

## Required Supabase settings

- Google provider enabled.
- Production callback URL allowed for `/auth/callback`.
- Manual identity linking enabled if Account Settings should let existing email/password users connect Google.
- Email confirmation enabled for email/password signup before trusting email ownership.
