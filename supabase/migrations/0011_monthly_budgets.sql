-- ============================================================================
-- Finance & Habit Tracker — 0011 Monthly Budget (overall allocation)
-- One overall monthly budget per user per month, on top of the existing
-- per-category `budgets` (which stay the allotments). Keyed by period_start so
-- future carry-over / history works. Amounts are exact numeric(12,2).
-- ============================================================================

create table public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,             -- first day of the budget month (local)
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  savings_target numeric(12, 2) not null default 0 check (savings_target >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

create index monthly_budgets_user_idx
  on public.monthly_budgets (user_id, period_start desc);

create trigger monthly_budgets_set_updated_at
  before update on public.monthly_budgets
  for each row execute function public.set_updated_at();

alter table public.monthly_budgets enable row level security;
create policy "monthly_budgets_owner_all" on public.monthly_budgets
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
