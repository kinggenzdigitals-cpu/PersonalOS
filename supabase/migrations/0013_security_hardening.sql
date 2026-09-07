-- ============================================================================
-- Finance & Habit Tracker — 0013 Security hardening
--
-- Fixes two real privilege/tenancy holes found in the RLS audit:
--
--  (A) PRIVILEGE ESCALATION. `profiles_owner_all` granted the owner INSERT and
--      DELETE, and the privilege guard `protect_profile_privileged` is a
--      BEFORE UPDATE trigger only. A user could therefore
--          delete from profiles where user_id = auth.uid();
--          insert into profiles (user_id, role) values (auth.uid(), 'super_admin');
--      and is_super_admin() would then return true. Profiles are created by the
--      signup trigger and removed by the auth.users cascade, so authenticated
--      users need neither INSERT nor DELETE.
--
--  (B) CROSS-TENANT REFERENCES. Owner policies only checked auth.uid()=user_id.
--      Foreign-key validation runs as the table owner and bypasses RLS, so a
--      user could insert their own row pointing at ANOTHER user's account /
--      category / bill / habit / task / transaction. The concrete damage is
--      denial of service on the victim's unique keys — e.g. claiming a
--      victim's habit_id + log_date blocks their own upsert
--      (unique (habit_id, log_date)). Their *balances* were never affected:
--      account_balances is security_invoker, so the attacker's row (owned by
--      the attacker) was never visible to the victim's read of the view.
--
-- Also: defence-in-depth on the balances view, the missing composite indexes,
-- and a duplicate guard for bill payments.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Ownership helpers. security invoker + stable: the EXISTS runs under the
-- caller's RLS, so it can only ever see the caller's own rows. NULL is allowed
-- so nullable FK columns stay optional.
-- ---------------------------------------------------------------------------

create or replace function public.owns_account(target uuid)
returns boolean language sql stable security invoker
set search_path = public as $$
  select target is null
     or exists (select 1 from public.accounts t where t.id = target);
$$;

create or replace function public.owns_category(target uuid)
returns boolean language sql stable security invoker
set search_path = public as $$
  select target is null
     or exists (select 1 from public.categories t where t.id = target);
$$;

create or replace function public.owns_bill(target uuid)
returns boolean language sql stable security invoker
set search_path = public as $$
  select target is null
     or exists (select 1 from public.bills t where t.id = target);
$$;

create or replace function public.owns_habit(target uuid)
returns boolean language sql stable security invoker
set search_path = public as $$
  select target is null
     or exists (select 1 from public.habits t where t.id = target);
$$;

create or replace function public.owns_task(target uuid)
returns boolean language sql stable security invoker
set search_path = public as $$
  select target is null
     or exists (select 1 from public.tasks t where t.id = target);
$$;

create or replace function public.owns_transaction(target uuid)
returns boolean language sql stable security invoker
set search_path = public as $$
  select target is null
     or exists (select 1 from public.transactions t where t.id = target);
$$;

-- ---------------------------------------------------------------------------
-- (A) profiles: SELECT + UPDATE only. No INSERT (signup trigger creates the
-- row) and no DELETE (auth.users cascade removes it).
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_owner_all" on public.profiles;
drop policy if exists "profiles_owner_select" on public.profiles;
drop policy if exists "profiles_owner_update" on public.profiles;

create policy "profiles_owner_select" on public.profiles
  for select to authenticated
  using (auth.uid() = user_id);

create policy "profiles_owner_update" on public.profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Defence in depth: even if an INSERT path is ever re-opened, a self-service
-- insert can never carry elevated privileges.
--
-- NOTE: these guards are deliberately SECURITY INVOKER (the default). A
-- SECURITY DEFINER trigger would set current_user to the function OWNER
-- (postgres, since migrations run as postgres), so the role test below would
-- always match the allow-list and the guard would silently never fire.
create or replace function public.protect_profile_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.role := 'user';
    new.status := 'active';
    new.must_change_password := false;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_insert on public.profiles;
create trigger profiles_protect_privileged_insert
  before insert on public.profiles
  for each row execute function public.protect_profile_insert();

-- The existing BEFORE UPDATE guard only exempted 'service_role', which also
-- silently reverted changes made by `postgres` (the SQL editor) — making it
-- impossible to promote the first super admin by hand. Allow the superuser
-- roles too; they can bypass triggers anyway, so this grants nothing new.
-- SECURITY INVOKER (default) is essential — see the note above.
create or replace function public.protect_profile_privileged()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.role := old.role;
    new.status := old.status;
    new.must_change_password := old.must_change_password;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- (B) Cross-tenant reference checks. USING is unchanged (owner rows only);
-- WITH CHECK additionally requires every referenced row to be the caller's.
-- ---------------------------------------------------------------------------

drop policy if exists "transactions_owner_all" on public.transactions;
create policy "transactions_owner_all" on public.transactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.owns_account(account_id)
    and public.owns_account(to_account_id)
    and public.owns_category(category_id)
    and public.owns_bill(bill_id)
  );

drop policy if exists "budgets_owner_all" on public.budgets;
create policy "budgets_owner_all" on public.budgets
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_category(category_id));

drop policy if exists "bills_owner_all" on public.bills;
create policy "bills_owner_all" on public.bills
  for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.owns_category(category_id)
    and public.owns_account(account_id)
  );

drop policy if exists "bill_payments_owner_all" on public.bill_payments;
create policy "bill_payments_owner_all" on public.bill_payments
  for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.owns_bill(bill_id)
    and public.owns_transaction(transaction_id)
  );

drop policy if exists "habit_logs_owner_all" on public.habit_logs;
create policy "habit_logs_owner_all" on public.habit_logs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_habit(habit_id));

-- ledger_entries (0003) — account_id + settled_transaction_id
drop policy if exists "ledger_entries_owner_all" on public.ledger_entries;
create policy "ledger_entries_owner_all" on public.ledger_entries
  for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.owns_account(account_id)
    and public.owns_transaction(settled_transaction_id)
  );

-- focus_sessions (0007) — task_id + habit_id
drop policy if exists "focus_sessions_owner_all" on public.focus_sessions;
create policy "focus_sessions_owner_all" on public.focus_sessions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.owns_task(task_id)
    and public.owns_habit(habit_id)
  );

-- ---------------------------------------------------------------------------
-- Defence in depth only: the view is already security_invoker, so a caller
-- never sees another user's transactions. This predicate additionally protects
-- any future service-role/BYPASSRLS reader from counting a cross-tenant row
-- left behind from before (B) was closed.
-- ---------------------------------------------------------------------------

create or replace view public.account_balances
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
    where (t.account_id = a.id or t.to_account_id = a.id)
      and t.user_id = a.user_id
  ), 0) as balance
from public.accounts a;

-- ---------------------------------------------------------------------------
-- Indexes for the hot budget/report paths (type + category + month range).
-- ---------------------------------------------------------------------------

create index if not exists transactions_user_type_occurred_idx
  on public.transactions (user_id, type, occurred_at desc);

create index if not exists transactions_user_category_occurred_idx
  on public.transactions (user_id, category_id, occurred_at desc);

create index if not exists ledger_entries_user_status_idx
  on public.ledger_entries (user_id, status);

-- ---------------------------------------------------------------------------
-- One payment per bill per due date. Created only when the existing data
-- allows it, so the migration can never fail on pre-existing duplicates.
-- ---------------------------------------------------------------------------

-- Keyed on user_id as well as the bill, so a pre-existing cross-tenant row
-- (possible before this migration) can never collide with, and lock out, the
-- rightful owner's payment.
do $$
begin
  if not exists (
    select 1 from public.bill_payments
    group by user_id, bill_id, paid_for_date having count(*) > 1
  ) then
    create unique index if not exists bill_payments_bill_period_key
      on public.bill_payments (user_id, bill_id, paid_for_date);
  else
    raise warning 'bill_payments has duplicate (user_id, bill_id, paid_for_date) rows; unique index skipped. De-duplicate, then re-run this migration.';
  end if;
end $$;
