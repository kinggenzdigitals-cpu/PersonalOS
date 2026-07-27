-- ============================================================================
-- Finance & Habit Tracker — 0010 Promotional offers
-- A genuine, server-created upgrade offer per user. started_at/expires_at are
-- the source of truth; the app never trusts the browser clock to extend it.
-- Prices live in code (src/lib/promo-config.ts) so they can't be tampered with.
-- ============================================================================

create type promo_status as enum ('active', 'expired', 'redeemed');

create table public.promotion_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  campaign text not null default 'annual-launch',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status promo_status not null default 'active',
  created_at timestamptz not null default now()
);

create index promotion_offers_user_idx
  on public.promotion_offers (user_id, created_at desc);

alter table public.promotion_offers enable row level security;

-- A user can read only their own offers. Offers are created server-side via the
-- service role (with fixed pricing), so there is no user insert/update policy —
-- normal users can never mint or extend their own offer.
create policy "promo_own_select" on public.promotion_offers
  for select to authenticated
  using (auth.uid() = user_id);
