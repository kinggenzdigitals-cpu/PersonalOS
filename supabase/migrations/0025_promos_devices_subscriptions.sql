-- Admin-controlled promo codes, richer subscription reporting, and device limits.

alter type access_type add value if not exists 'promo';

alter table public.subscriptions
  add column if not exists current_period_start timestamptz,
  add column if not exists billing_period text,
  add column if not exists amount_paid numeric(12, 2),
  add column if not exists promo_code_id uuid,
  add column if not exists promo_code text;

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  plan text not null check (plan in ('pro', 'premium')),
  duration_months int not null check (duration_months > 0),
  max_redemptions int check (max_redemptions is null or max_redemptions > 0),
  expires_at timestamptz,
  active boolean not null default true,
  special_price numeric(12, 2),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promo_codes_active_idx
  on public.promo_codes (active, expires_at);

create trigger promo_codes_set_updated_at
  before update on public.promo_codes
  for each row execute function public.set_updated_at();

alter table public.promo_codes enable row level security;

drop policy if exists "promo_codes_admin_read" on public.promo_codes;
drop policy if exists "promo_codes_admin_write" on public.promo_codes;
drop policy if exists "promo_codes_admin_update" on public.promo_codes;
drop policy if exists "promo_codes_admin_delete" on public.promo_codes;

create policy "promo_codes_admin_read" on public.promo_codes
  for select to authenticated
  using (public.is_super_admin());

create policy "promo_codes_admin_write" on public.promo_codes
  for insert to authenticated
  with check (public.is_permanent_super_admin());

create policy "promo_codes_admin_update" on public.promo_codes
  for update to authenticated
  using (public.is_permanent_super_admin())
  with check (public.is_permanent_super_admin());

create policy "promo_codes_admin_delete" on public.promo_codes
  for delete to authenticated
  using (public.is_permanent_super_admin());

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'canceled')),
  amount_paid numeric(12, 2),
  invoice_external_id text unique,
  redeemed_at timestamptz,
  access_starts_at timestamptz,
  access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promo_code_id, user_id)
);

create index if not exists promo_redemptions_user_idx
  on public.promo_redemptions (user_id, created_at desc);
create index if not exists promo_redemptions_code_idx
  on public.promo_redemptions (promo_code_id, status);

create trigger promo_redemptions_set_updated_at
  before update on public.promo_redemptions
  for each row execute function public.set_updated_at();

alter table public.promo_redemptions enable row level security;

drop policy if exists "promo_redemptions_owner_read" on public.promo_redemptions;
drop policy if exists "promo_redemptions_admin_read" on public.promo_redemptions;

create policy "promo_redemptions_owner_read" on public.promo_redemptions
  for select to authenticated
  using (auth.uid() = user_id);

create policy "promo_redemptions_admin_read" on public.promo_redemptions
  for select to authenticated
  using (public.is_super_admin());

create table if not exists public.account_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_token_hash text not null,
  name text not null default 'Unknown device',
  user_agent text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_token_hash)
);

create index if not exists account_devices_user_active_idx
  on public.account_devices (user_id, revoked_at, last_seen_at desc);

create trigger account_devices_set_updated_at
  before update on public.account_devices
  for each row execute function public.set_updated_at();

alter table public.account_devices enable row level security;

drop policy if exists "account_devices_owner_read" on public.account_devices;
drop policy if exists "account_devices_owner_update" on public.account_devices;

create policy "account_devices_owner_read" on public.account_devices
  for select to authenticated
  using (auth.uid() = user_id);

create policy "account_devices_owner_update" on public.account_devices
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.subscriptions
  drop constraint if exists subscriptions_promo_code_id_fkey;
alter table public.subscriptions
  add constraint subscriptions_promo_code_id_fkey
  foreign key (promo_code_id) references public.promo_codes (id) on delete set null;
