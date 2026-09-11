# Environment variables

Copy `.env.local.example` to `.env.local` for local development. Production values must be configured in Vercel Project Settings and GitHub Actions secrets. Never commit real secrets.

Required for production:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Public Supabase anon/publishable key; RLS protects data. |
| `NEXT_PUBLIC_SITE_URL` | Browser + server | Canonical site URL for OAuth redirects, sitemap, and checkout returns. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin/webhook writes that must bypass RLS. Production preflight fails when this is missing. |
| `SUPER_ADMIN_EMAILS` | Server only | Comma-separated confirmed emails that may become super admins. Leave empty unless needed. |
| `XENDIT_SECRET_KEY` | Server only | Creates invoices/subscription payments. |
| `XENDIT_WEBHOOK_TOKEN` | Server only | Verifies payment callbacks. |
| `NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS` | Browser | Set to `true` when the Vercel plan/project supports Speed Insights. |

Run this before launch or deployment promotion:

```bash
npm run launch:preflight
```

The preflight exits non-zero if a required production value is missing or still looks like a placeholder.
