-- ============================================================================
-- Life OS — 0002 Row Level Security
-- Every table is scoped to its owner: auth.uid() = user_id.
-- No user can ever read or write another user's rows.
-- ============================================================================

-- Helper: enable RLS + a single owner policy covering all operations.
-- (Written out per-table for clarity and auditability.)

-- profiles ------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "profiles_owner_all" on public.profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- accounts ------------------------------------------------------------------
alter table public.accounts enable row level security;
create policy "accounts_owner_all" on public.accounts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- categories ----------------------------------------------------------------
alter table public.categories enable row level security;
create policy "categories_owner_all" on public.categories
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- bills ---------------------------------------------------------------------
alter table public.bills enable row level security;
create policy "bills_owner_all" on public.bills
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- transactions --------------------------------------------------------------
alter table public.transactions enable row level security;
create policy "transactions_owner_all" on public.transactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- bill_payments -------------------------------------------------------------
alter table public.bill_payments enable row level security;
create policy "bill_payments_owner_all" on public.bill_payments
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- budgets -------------------------------------------------------------------
alter table public.budgets enable row level security;
create policy "budgets_owner_all" on public.budgets
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- habits --------------------------------------------------------------------
alter table public.habits enable row level security;
create policy "habits_owner_all" on public.habits
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- habit_logs ----------------------------------------------------------------
alter table public.habit_logs enable row level security;
create policy "habit_logs_owner_all" on public.habit_logs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- mood_entries --------------------------------------------------------------
alter table public.mood_entries enable row level security;
create policy "mood_entries_owner_all" on public.mood_entries
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- tasks ---------------------------------------------------------------------
alter table public.tasks enable row level security;
create policy "tasks_owner_all" on public.tasks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- calendar_events -----------------------------------------------------------
alter table public.calendar_events enable row level security;
create policy "calendar_events_owner_all" on public.calendar_events
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
