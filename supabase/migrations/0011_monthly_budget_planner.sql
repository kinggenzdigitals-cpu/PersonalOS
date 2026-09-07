-- ============================================================================
-- Life OS — 0011 Monthly Budget Planner
-- Month-specific category allotments, savings allocations, sinking funds,
-- carry-over settings, and contribution history for monthly progress.
-- ============================================================================

-- Existing budgets become the starting allotments for the migration month.
alter table public.budgets
  add column month_start date;

update public.budgets
set month_start = date_trunc('month', current_date)::date
where month_start is null;

alter table public.budgets
  alter column month_start set not null;

alter table public.budgets
  drop constraint budgets_user_id_category_id_key;

alter table public.budgets
  add constraint budgets_user_category_month_key
  unique (user_id, category_id, month_start);

create index budgets_user_month_idx
  on public.budgets (user_id, month_start);

-- One top-level plan per user and calendar month.
create table public.monthly_budget_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_start date not null,
  total_budget numeric(14, 2) not null default 0 check (total_budget >= 0),
  expected_income numeric(14, 2) not null default 0 check (expected_income >= 0),
  carry_over_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_start),
  constraint monthly_budget_plans_month_start_check
    check (month_start = date_trunc('month', month_start)::date)
);

create index monthly_budget_plans_user_month_idx
  on public.monthly_budget_plans (user_id, month_start desc);

create trigger monthly_budget_plans_set_updated_at
  before update on public.monthly_budget_plans
  for each row execute function public.set_updated_at();

alter table public.monthly_budget_plans enable row level security;
create policy "monthly_budget_plans_owner_all" on public.monthly_budget_plans
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Goal metadata distinguishes regular goals from recurring sinking funds.
create type savings_goal_type as enum (
  'standard',
  'sinking_fund',
  'emergency_fund'
);

alter table public.savings_goals
  add column goal_type savings_goal_type not null default 'standard',
  add column target_date date,
  add column monthly_target numeric(14, 2)
    check (monthly_target is null or monthly_target >= 0);

alter table public.savings_goals
  add constraint savings_goals_id_user_key unique (id, user_id);

-- Required savings are part of the monthly budget allocation.
create table public.monthly_goal_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_start date not null,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_start, goal_id),
  constraint monthly_goal_allocations_month_start_check
    check (month_start = date_trunc('month', month_start)::date),
  constraint monthly_goal_allocations_owned_goal_fk
    foreign key (goal_id, user_id)
    references public.savings_goals (id, user_id)
    on delete cascade
);

create index monthly_goal_allocations_user_month_idx
  on public.monthly_goal_allocations (user_id, month_start);

create trigger monthly_goal_allocations_set_updated_at
  before update on public.monthly_goal_allocations
  for each row execute function public.set_updated_at();

alter table public.monthly_goal_allocations enable row level security;
create policy "monthly_goal_allocations_owner_all"
  on public.monthly_goal_allocations
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Contribution history makes monthly savings progress measurable. Existing
-- saved_amount values remain valid as starting balances and are not backfilled.
create table public.savings_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  contributed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint savings_goal_contributions_owned_goal_fk
    foreign key (goal_id, user_id)
    references public.savings_goals (id, user_id)
    on delete cascade
);

create index savings_goal_contributions_user_date_idx
  on public.savings_goal_contributions (user_id, contributed_at desc);
create index savings_goal_contributions_goal_idx
  on public.savings_goal_contributions (goal_id, contributed_at desc);

alter table public.savings_goal_contributions enable row level security;
create policy "savings_goal_contributions_owner_all"
  on public.savings_goal_contributions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Update the goal balance and record the contribution in one transaction.
create or replace function public.contribute_to_savings_goal(
  p_goal_id uuid,
  p_amount numeric,
  p_contributed_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  contribution_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Contribution amount must be greater than zero.';
  end if;

  update public.savings_goals
  set saved_amount = saved_amount + p_amount
  where id = p_goal_id and user_id = auth.uid();

  if not found then
    raise exception 'Savings goal not found.';
  end if;

  insert into public.savings_goal_contributions (
    user_id,
    goal_id,
    amount,
    contributed_at
  )
  values (auth.uid(), p_goal_id, p_amount, p_contributed_at)
  returning id into contribution_id;

  return contribution_id;
end;
$$;

grant execute on function public.contribute_to_savings_goal(uuid, numeric, timestamptz)
  to authenticated;
