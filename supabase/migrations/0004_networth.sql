-- ============================================================================
-- Life OS — 0004 Assets & Liabilities (net worth)
-- Non-liquid assets and liabilities. Net worth combines these with liquid
-- account balances and receivables/payables (computed in the app).
-- ============================================================================

create type asset_kind as enum (
  'property', 'investment', 'business', 'vehicle', 'cash', 'other'
);
create type liability_kind as enum (
  'mortgage', 'loan', 'credit_card', 'other'
);

-- assets --------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind asset_kind not null default 'other',
  value numeric(14, 2) not null default 0 check (value >= 0),
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_user_idx on public.assets (user_id, sort_order);

create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

-- liabilities ---------------------------------------------------------------
create table public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind liability_kind not null default 'other',
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index liabilities_user_idx on public.liabilities (user_id, sort_order);

create trigger liabilities_set_updated_at
  before update on public.liabilities
  for each row execute function public.set_updated_at();

-- Row Level Security --------------------------------------------------------
alter table public.assets enable row level security;
create policy "assets_owner_all" on public.assets
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.liabilities enable row level security;
create policy "liabilities_owner_all" on public.liabilities
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
