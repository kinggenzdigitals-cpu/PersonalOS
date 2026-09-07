-- ============================================================================
-- Finance & Habit Tracker — 0018 Super-admin grant source (self-revoking)
--
-- Admin can be granted two ways, and they must behave differently:
--   'bootstrap' — promoted automatically because the account's CONFIRMED email
--                 is on the SUPER_ADMIN_EMAILS allow-list. Self-revokes as soon
--                 as the email leaves the list.
--   'manual'    — granted deliberately (SQL, or another admin). NEVER revoked
--                 automatically; removing an env var must not silently strip a
--                 real administrator.
--
-- SECURITY: role_source is pinned by the same trigger that pins role/status.
-- Without that, a bootstrap-promoted admin could simply update their own
-- profile to role_source = 'manual' and make the grant permanent, defeating the
-- whole mechanism. profiles is owner-updatable (0013), so this matters.
--
-- Existing super admins are backfilled as 'manual': applying this migration
-- must never demote whoever is already an administrator, so the fail-safe
-- direction is "treat what is already there as deliberate". Accounts promoted
-- from the allow-list AFTER this migration are tagged 'bootstrap' and do
-- self-revoke; the app also tags any still-untagged super admin on sight.
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists role_source text;

do $$
begin
  -- conname is unique per (table, schema), not globally — scope by conrelid or
  -- an unrelated table's constraint of the same name would skip this silently.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and conname = 'profiles_role_source_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_source_check
      check (role_source is null or role_source in ('bootstrap', 'manual'));
  end if;
end $$;

-- Anyone already holding the role got it deliberately — protect them.
update public.profiles
   set role_source = 'manual'
 where role = 'super_admin'
   and role_source is null;

-- ---------------------------------------------------------------------------
-- Pin role_source alongside the other privileged columns.
-- SECURITY INVOKER (default) is essential — a SECURITY DEFINER trigger would
-- make current_user the function owner and the guard would never fire.
-- ---------------------------------------------------------------------------

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
    new.role_source := old.role_source;
  end if;
  return new;
end;
$$;

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
    new.role_source := null;
  end if;
  return new;
end;
$$;

-- The whole security argument above rests on this trigger existing. 0008
-- created it with a bare `create trigger`, so a schema restored without it
-- would leave profiles owner-updatable with NO privilege guard and this
-- migration would still report success. Assert it rather than assume it.
drop trigger if exists profiles_protect_privileged on public.profiles;
create trigger profiles_protect_privileged
  before update on public.profiles
  for each row execute function public.protect_profile_privileged();

drop trigger if exists profiles_protect_privileged_insert on public.profiles;
create trigger profiles_protect_privileged_insert
  before insert on public.profiles
  for each row execute function public.protect_profile_insert();
