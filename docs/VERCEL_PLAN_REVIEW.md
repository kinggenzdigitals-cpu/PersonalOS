# Vercel plan and monitoring review

The codebase now includes:

- Vercel Web Analytics in `src/app/layout.tsx`.
- Optional Speed Insights in `src/app/layout.tsx`, controlled by `NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS`.
- `robots.ts`, `sitemap.ts`, and structured root metadata for public pages.
- GitHub Actions checks for audit, typecheck, lint, tests, and production build.
- A production preflight workflow that fails when required secrets are absent.

Before taking payments, review whether the current Hobby plan covers the application’s commercial use, expected traffic, support expectations, observability needs, team access, deployment protection, and incident response needs. If any item is business-critical, move the project to the paid plan that covers it before public launch.

Custom domain and Web Analytics are configured in Vercel, not only in code. After adding the domain, set `NEXT_PUBLIC_SITE_URL` to the final production URL and rerun the production preflight.
