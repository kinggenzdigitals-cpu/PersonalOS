-- ============================================================================
-- Life OS — 0005 Savings Goals
-- Named goals with a target and the amount saved/allocated toward them.
-- ============================================================================

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  saved_amount numeric(14, 2) not null default 0 check (saved_amount >= 0),
  color text,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index savings_goals_user_idx on public.savings_goals (user_id, sort_order);

create trigger savings_goals_set_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();

alter table public.savings_goals enable row level security;
create policy "savings_goals_owner_all" on public.savings_goals
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
