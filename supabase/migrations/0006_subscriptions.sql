-- ============================================================================
-- Life OS — 0006 Subscriptions (billing foundation, Xendit)
-- Tracks each user's plan + subscription status. Written by the Xendit webhook
-- (service role); readable by the owner. No billing secrets are stored here.
-- ============================================================================

create type subscription_status as enum (
  'inactive', 'active', 'past_due', 'canceled'
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan text not null default 'free',
  status subscription_status not null default 'inactive',
  interval text, -- 'monthly' | 'yearly'
  xendit_customer_id text,
  xendit_plan_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Owner can read their subscription. Writes happen via the webhook using the
-- service role, which bypasses RLS.
alter table public.subscriptions enable row level security;
create policy "subscriptions_owner_read" on public.subscriptions
  for select to authenticated
  using (auth.uid() = user_id);
