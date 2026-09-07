-- ============================================================================
-- Life OS — 0011 Monthly Budget Planner
-- Month-specific category allotments, savings allocations, sinking funds,
-- carry-over settings, and contribution history for monthly progress.
-- ============================================================================

-- Additive rollout: keep legacy budgets and their conflict key unchanged so
-- the currently deployed application can still read/write during rollout.
-- This draft migration has not been applied in production.
begin;

alter table public.categories
  add constraint categories_id_user_key unique (id, user_id);

create table public.monthly_category_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null,
  month_start date not null check (extract(day from month_start) = 1),
  amount numeric(12, 2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  period budget_period not null default 'monthly',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, month_start),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete cascade
);

create index monthly_category_budgets_user_month_idx
  on public.monthly_category_budgets (user_id, month_start);
create trigger monthly_category_budgets_set_updated_at
  before update on public.monthly_category_budgets
  for each row execute function public.set_updated_at();
alter table public.monthly_category_budgets enable row level security;
create policy "monthly_category_budgets_owner_all" on public.monthly_category_budgets
  for all to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Copy existing records into the owner's local month, never the server month.
insert into public.monthly_category_budgets
  (id, user_id, category_id, month_start, amount, period, active, created_at, updated_at)
select b.id, b.user_id, b.category_id,
  date_trunc('month', now() at time zone coalesce(p.timezone, 'Asia/Manila'))::date,
  b.amount, b.period, b.active, b.created_at, b.updated_at
from public.budgets b
left join public.profiles p on p.user_id = b.user_id;

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

insert into public.monthly_budget_plans (user_id, month_start, total_budget, carry_over_enabled)
select user_id, month_start, sum(amount), false
from public.monthly_category_budgets where active
group by user_id, month_start;

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
  if auth.uid() is null then
    raise exception 'Sign in before adding funds.';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric
     or p_amount > 999999999999.99 then
    raise exception 'Contribution amount must be greater than zero.';
  end if;
  if p_contributed_at is null or p_contributed_at > now() then
    raise exception 'Contribution date cannot be in the future.';
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

revoke execute on function public.contribute_to_savings_goal(uuid, numeric, timestamptz)
  from public, anon;
grant select, insert, update, delete on public.monthly_category_budgets,
  public.monthly_budget_plans, public.monthly_goal_allocations,
  public.savings_goal_contributions to authenticated;

-- Templates/copy are a single transaction and only fill an empty month.
-- A retry never overwrites amounts the owner already edited.
create function public.initialize_monthly_budget(
  p_month date, p_total numeric, p_income numeric, p_carry boolean,
  p_categories jsonb, p_savings jsonb
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in before saving a plan.'; end if;
  if p_month is null or extract(day from p_month) <> 1 or p_total is null
     or p_total <= 0 or p_total = 'NaN'::numeric or p_income is null
     or p_income < 0 or p_income = 'NaN'::numeric then
    raise exception 'Invalid monthly plan.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_month::text, 0));
  if exists(select 1 from public.monthly_category_budgets where user_id=auth.uid() and month_start=p_month)
     or exists(select 1 from public.monthly_goal_allocations where user_id=auth.uid() and month_start=p_month) then
    raise exception 'This month already has allotments. Edit them individually or choose an empty month.';
  end if;
  insert into public.monthly_budget_plans(user_id, month_start, total_budget, expected_income, carry_over_enabled)
  values(auth.uid(),p_month,p_total,p_income,p_carry)
  on conflict(user_id,month_start) do nothing;
  insert into public.monthly_category_budgets(user_id,month_start,category_id,amount)
  select auth.uid(),p_month,x.category_id,x.amount
  from jsonb_to_recordset(p_categories) as x(category_id uuid,amount numeric);
  insert into public.monthly_goal_allocations(user_id,month_start,goal_id,amount)
  select auth.uid(),p_month,x.goal_id,x.amount
  from jsonb_to_recordset(p_savings) as x(goal_id uuid,amount numeric);
end;
$$;
revoke execute on function public.initialize_monthly_budget(date,numeric,numeric,boolean,jsonb,jsonb) from public,anon;
grant execute on function public.initialize_monthly_budget(date,numeric,numeric,boolean,jsonb,jsonb) to authenticated;

commit;
