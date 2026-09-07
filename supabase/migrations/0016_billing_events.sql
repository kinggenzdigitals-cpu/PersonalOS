-- ============================================================================
-- Finance & Habit Tracker — 0016 Billing events (webhook idempotency)
--
-- Xendit retries callbacks, and a duplicate PAID for the same invoice used to
-- re-run the upsert and recompute current_period_end from `now`, silently
-- extending a subscription on every replay. Recording each processed invoice
-- makes the webhook idempotent: the second delivery is acknowledged and
-- ignored.
--
-- Written and read ONLY by the service role (the webhook). No policy is created
-- for `authenticated`, so with RLS enabled the table is invisible to users.
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'xendit',
  event_id text not null,              -- Xendit invoice id (or external_id)
  external_id text,
  user_id uuid references auth.users (id) on delete set null,
  status text not null,
  amount numeric(12, 2),
  processed_at timestamptz not null default now(),
  -- Keyed on status too: a PENDING or EXPIRED callback for an invoice must not
  -- consume the key and block the PAID one that follows it.
  unique (provider, event_id, status)
);

create index if not exists billing_events_user_idx
  on public.billing_events (user_id, processed_at desc);

alter table public.billing_events enable row level security;
-- Intentionally no policies: service-role only.
