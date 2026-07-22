-- ============================================================================
-- Life OS — 0001 schema
-- Tables, enums, derived balance view, indexes, triggers, and signup seeding.
-- RLS policies live in 0002_rls.sql.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type account_type as enum ('cash', 'ewallet', 'bank', 'savings', 'other');
create type category_kind as enum ('income', 'expense');
create type transaction_type as enum ('income', 'expense', 'transfer', 'adjustment');
create type adjustment_direction as enum ('in', 'out');
create type budget_period as enum ('monthly');
create type bill_frequency as enum ('once', 'weekly', 'monthly', 'yearly');
create type life_area as enum (
  'physical', 'emotional', 'spiritual', 'mental', 'work', 'relationships', 'growth'
);
create type habit_status as enum ('completed', 'skipped', 'missed');
create type task_status as enum ('todo', 'done', 'cancelled', 'backlog');
create type calendar_event_kind as enum ('appointment', 'personal', 'work', 'other');

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  currency text not null default 'PHP',
  timezone text not null default 'Asia/Manila',
  week_starts_on text not null default 'monday'
    check (week_starts_on in ('monday', 'sunday')),
  onboarded boolean not null default false,
  low_balance_threshold numeric(12, 2) not null default 500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type account_type not null default 'cash',
  opening_balance numeric(12, 2) not null default 0,
  is_spending boolean not null default true,
  archived boolean not null default false,
  sort_order int not null default 0,
  icon text,
  color text,
  low_balance_threshold numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_idx on public.accounts (user_id, sort_order);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind category_kind not null,
  icon text,
  color text,
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_user_idx on public.categories (user_id, kind, sort_order);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bills (created before transactions: transactions.bill_id references it)
-- ---------------------------------------------------------------------------
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  frequency bill_frequency not null default 'monthly',
  next_due_date date not null,
  remind_days_before int not null default 3 check (remind_days_before >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bills_user_due_idx on public.bills (user_id, next_due_date);

create trigger bills_set_updated_at
  before update on public.bills
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type transaction_type not null,
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid not null references public.accounts (id) on delete cascade,
  to_account_id uuid references public.accounts (id) on delete cascade,
  direction adjustment_direction,
  occurred_at timestamptz not null default now(),
  merchant text,
  notes text,
  bill_id uuid references public.bills (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- transfers require a distinct destination account
  constraint transfer_needs_destination check (
    type <> 'transfer'
    or (to_account_id is not null and to_account_id <> account_id)
  ),
  -- only transfers may set a destination account
  constraint destination_only_for_transfer check (
    type = 'transfer' or to_account_id is null
  ),
  -- adjustments require a direction; nothing else may set one
  constraint direction_only_for_adjustment check (
    (type = 'adjustment' and direction is not null)
    or (type <> 'adjustment' and direction is null)
  ),
  -- transfers/adjustments are never categorised
  constraint no_category_for_transfer check (
    type not in ('transfer', 'adjustment') or category_id is null
  )
);

create index transactions_user_occurred_idx
  on public.transactions (user_id, occurred_at desc);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id);
create index transactions_category_idx on public.transactions (category_id);
create index transactions_bill_idx on public.transactions (bill_id);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bill_payments
-- ---------------------------------------------------------------------------
create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  paid_for_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bill_payments_user_idx on public.bill_payments (user_id, bill_id);

create trigger bill_payments_set_updated_at
  before update on public.bill_payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  period budget_period not null default 'monthly',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create index budgets_user_idx on public.budgets (user_id);

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  life_area life_area not null,
  schedule_days int[] not null default '{}',
  reminder_time time,
  active boolean not null default true,
  sort_order int not null default 0,
  icon text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index habits_user_idx on public.habits (user_id, sort_order);

create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- habit_logs
-- ---------------------------------------------------------------------------
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  log_date date not null,
  status habit_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);
create index habit_logs_habit_idx on public.habit_logs (habit_id, log_date);

create trigger habit_logs_set_updated_at
  before update on public.habit_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- mood_entries
-- ---------------------------------------------------------------------------
create table public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  mood int not null check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  stress int check (stress between 1 and 5),
  gratitude text,
  wins text,
  struggles text,
  prayer_requests text,
  journal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index mood_entries_user_date_idx on public.mood_entries (user_id, entry_date desc);

create trigger mood_entries_set_updated_at
  before update on public.mood_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  due_date date,
  status task_status not null default 'todo',
  is_priority boolean not null default false,
  priority_date date,
  completed_at timestamptz,
  sort_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_due_idx on public.tasks (user_id, due_date);
create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_priority_idx on public.tasks (user_id, priority_date)
  where is_priority;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- calendar_events
-- ---------------------------------------------------------------------------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  kind calendar_event_kind not null default 'other',
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  notes text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index calendar_events_user_start_idx
  on public.calendar_events (user_id, start_at);

create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- account_balances view (derived, security_invoker → respects RLS)
-- balance = opening_balance + Σ(in) − Σ(out)
-- ---------------------------------------------------------------------------
create view public.account_balances
with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.is_spending,
  a.archived,
  a.opening_balance,
  a.opening_balance + coalesce((
    select sum(
      case
        when t.type = 'income'     and t.account_id = a.id then t.amount
        when t.type = 'expense'    and t.account_id = a.id then -t.amount
        when t.type = 'transfer'   and t.account_id = a.id then -t.amount
        when t.type = 'transfer'   and t.to_account_id = a.id then t.amount
        when t.type = 'adjustment' and t.account_id = a.id and t.direction = 'in'  then t.amount
        when t.type = 'adjustment' and t.account_id = a.id and t.direction = 'out' then -t.amount
        else 0
      end
    )
    from public.transactions t
    where t.account_id = a.id or t.to_account_id = a.id
  ), 0) as balance
from public.accounts a;

-- ---------------------------------------------------------------------------
-- Signup handler: create profile + seed default categories
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', null));

  -- Seed expense categories
  insert into public.categories (user_id, name, kind, is_system, sort_order)
  values
    (new.id, 'Food',          'expense', true, 1),
    (new.id, 'Transportation','expense', true, 2),
    (new.id, 'Bills',         'expense', true, 3),
    (new.id, 'Shopping',      'expense', true, 4),
    (new.id, 'Health',        'expense', true, 5),
    (new.id, 'Family',        'expense', true, 6),
    (new.id, 'Church/Giving', 'expense', true, 7),
    (new.id, 'Business',      'expense', true, 8),
    (new.id, 'Entertainment', 'expense', true, 9),
    (new.id, 'Other',         'expense', true, 10);

  -- Seed income categories
  insert into public.categories (user_id, name, kind, is_system, sort_order)
  values
    (new.id, 'Salary',      'income', true, 1),
    (new.id, 'Business',    'income', true, 2),
    (new.id, 'Side Income', 'income', true, 3),
    (new.id, 'Gift',        'income', true, 4),
    (new.id, 'Other',       'income', true, 5);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
