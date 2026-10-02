-- ============================================================================
-- Finance & Habit Tracker — 0027 Account status enforced at the database
--
-- profiles.status ('suspended' / 'revoked') was only read by the page ladder
-- in lib/auth.ts, which runs on render. A suspended account's live session
-- could still read and write every owner table straight through PostgREST with
-- the anon key, for as long as its token kept refreshing. This makes RLS
-- refuse it too.
--
-- RESTRICTIVE policies are ANDed with the existing permissive owner policies,
-- so no owner policy is rewritten. profiles and subscriptions are left out on
-- purpose: the auth ladder and getEntitlement() must still read them to send a
-- suspended user to /suspended.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- True unless the caller's own profile says otherwise. No profile row yet
-- (pre-onboarding) counts as active: the app ladder handles that rung.
-- SECURITY DEFINER like is_super_admin(), so it can read profiles from inside
-- any table's policy.
-- ---------------------------------------------------------------------------
create or replace function public.account_active()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
     where user_id = auth.uid()
       and status <> 'active'
  );
$$;

revoke all on function public.account_active() from public, anon;
grant execute on function public.account_active() to authenticated;

-- ---------------------------------------------------------------------------
-- One restrictive policy per owner data table. `(select ...)` makes Postgres
-- evaluate the helper once per statement rather than once per row. Tables a
-- database doesn't have yet are skipped, so this applies on any migration
-- level and picks them up on a re-run.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'transactions', 'transaction_favorites',
    'merchant_categories', 'ledger_entries', 'bills', 'bill_payments',
    'budgets', 'monthly_budgets', 'habits', 'habit_logs', 'mood_entries',
    'tasks', 'task_projects', 'task_comments', 'calendar_events',
    'focus_sessions', 'user_preferences', 'assets', 'liabilities',
    'savings_goals', 'feedback', 'import_batches', 'account_devices'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_account_active', t);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated '
        'using ((select public.account_active())) '
        'with check ((select public.account_active()))',
        t || '_account_active', t);
    end if;
  end loop;
end $$;

-- ===========================================================================
-- One-off backfill: ban accounts that were locked before bans existed.
--
-- setAccountStatus() now bans a suspended or revoked account in GoTrue, which
-- stops its session refreshing and blocks auth.updateUser() (email and
-- password changes) straight from the browser with the anon key. Suspensions
-- made before that change were never banned, and the admin UI only offers
-- "Suspend" on an active account, so nothing else would ever ban them.
--
-- This bans every account whose profiles.status is set and not 'active' and
-- that isn't banned already, with the same 876000h ban the app uses
-- (banDurationFor in lib/account-status.ts). It then deletes the sessions of
-- exactly those accounts, which also drops their refresh tokens (cascade).
-- An active account (or a NULL status, which reads as active) never matches.
-- One statement, so it applies all or nothing. Re-running is harmless:
-- accounts banned on the first run are skipped and their sessions are gone.
-- ===========================================================================
with newly_banned as (
  update auth.users u
     set banned_until = now() + interval '876000 hours'
    from public.profiles p
   where p.user_id = u.id
     and p.status <> 'active'
     and (u.banned_until is null or u.banned_until <= now())
  returning u.id
)
delete from auth.sessions s
 using newly_banned b
 where s.user_id = b.id;
