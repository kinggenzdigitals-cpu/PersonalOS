-- ============================================================================
-- Finance & Habit Tracker — 0019 Admin tier at the RLS layer
--
-- 0018 introduced provisional ('bootstrap') vs permanent ('manual') admins, but
-- the distinction lived ONLY in TypeScript. `is_super_admin()` reads
-- profiles.role alone, so at the database layer a provisional admin was
-- indistinguishable from the owner — and 0009 granted:
--
--   create policy "invitations_admin_all" on public.user_invitations
--     for all to authenticated using (public.is_super_admin());
--
-- PostgREST is a parallel, ungated path to that policy: a provisional admin
-- could INSERT a forged invitation straight from the browser with the anon key
-- and their own session, bypassing every server-action guard, then redeem it at
-- the unauthenticated /invite endpoint. Server actions are not the security
-- boundary; RLS is.
--
-- This splits the predicate: READ stays open to any admin, WRITE requires a
-- permanent one. Adopt the same convention for any future admin-write policy.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Permanent = holds the role AND was not auto-granted from the email
-- allow-list. An untagged role (promoted before 0018) counts as provisional:
-- fail CLOSED, since the whole point of the tier is to be withdrawable.
-- ---------------------------------------------------------------------------
create or replace function public.is_permanent_super_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where user_id = auth.uid()
       and role = 'super_admin'
       and role_source = 'manual'
  );
$$;

-- ---------------------------------------------------------------------------
-- user_invitations: any admin may read; only a permanent admin may write.
-- Invitation rows mint credentials, so writes are the sensitive half.
-- ---------------------------------------------------------------------------

drop policy if exists "invitations_admin_all" on public.user_invitations;
drop policy if exists "invitations_admin_read" on public.user_invitations;
drop policy if exists "invitations_admin_write" on public.user_invitations;
drop policy if exists "invitations_admin_update" on public.user_invitations;
drop policy if exists "invitations_admin_delete" on public.user_invitations;

create policy "invitations_admin_read" on public.user_invitations
  for select to authenticated
  using (public.is_super_admin());

create policy "invitations_admin_write" on public.user_invitations
  for insert to authenticated
  with check (public.is_permanent_super_admin());

create policy "invitations_admin_update" on public.user_invitations
  for update to authenticated
  using (public.is_permanent_super_admin())
  with check (public.is_permanent_super_admin());

create policy "invitations_admin_delete" on public.user_invitations
  for delete to authenticated
  using (public.is_permanent_super_admin());

-- ---------------------------------------------------------------------------
-- feedback: admin update is triage, which provisional admins may do — but
-- restate it explicitly so the read/write convention is visible in one place.
-- ---------------------------------------------------------------------------

drop policy if exists "feedback_admin_update" on public.feedback;
create policy "feedback_admin_update" on public.feedback
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
