-- ============================================================================
-- Finance & Habit Tracker — 0014 Faster transaction entry
--
--   • merchant_categories  — PER-USER learned merchant → category mappings.
--     Learning is never shared between users: the table is owner-scoped by RLS
--     and keyed on (user_id, merchant_key).
--   • transaction_favorites — saved frequently-used transactions for one-tap
--     re-entry (Internet ₱1,699, Netflix ₱549, Fuel, …). Amount is optional so
--     a favourite can prefill just the merchant/category/account.
--
-- Both carry the cross-tenant WITH CHECK guards introduced in 0013.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Learned merchant → category mappings (per user)
-- ---------------------------------------------------------------------------

create table if not exists public.merchant_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant_key text not null check (length(merchant_key) between 1 and 120),
  category_id uuid not null references public.categories (id) on delete cascade,
  hit_count integer not null default 1 check (hit_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_key)
);

create index if not exists merchant_categories_user_idx
  on public.merchant_categories (user_id, merchant_key);

drop trigger if exists merchant_categories_set_updated_at on public.merchant_categories;
create trigger merchant_categories_set_updated_at
  before update on public.merchant_categories
  for each row execute function public.set_updated_at();

alter table public.merchant_categories enable row level security;

drop policy if exists "merchant_categories_owner_all" on public.merchant_categories;
create policy "merchant_categories_owner_all" on public.merchant_categories
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_category(category_id));

-- ---------------------------------------------------------------------------
-- Saved / favourite transactions
-- ---------------------------------------------------------------------------

create table if not exists public.transaction_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  type transaction_type not null default 'expense',
  amount numeric(12, 2) check (amount is null or amount > 0),
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  merchant text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint favorite_type_is_simple check (type in ('income', 'expense'))
);

create index if not exists transaction_favorites_user_idx
  on public.transaction_favorites (user_id, sort_order);

drop trigger if exists transaction_favorites_set_updated_at on public.transaction_favorites;
create trigger transaction_favorites_set_updated_at
  before update on public.transaction_favorites
  for each row execute function public.set_updated_at();

alter table public.transaction_favorites enable row level security;

drop policy if exists "transaction_favorites_owner_all" on public.transaction_favorites;
create policy "transaction_favorites_owner_all" on public.transaction_favorites
  for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.owns_category(category_id)
    and public.owns_account(account_id)
  );
