-- ============================================================================
-- Finance & Habit Tracker — 0028 Audit trail outlives its actor; owners can
-- delete their own feedback
--
-- 1. admin_audit_log.admin_id was `not null ... on delete cascade`, so deleting
--    an administrator's auth user erased every audit row they wrote — the
--    record of what they did went with them. The column is now nullable and
--    `on delete set null`, and admin_label keeps who it was: filled from
--    auth.users on every insert (and backfilled here), so no app code has to
--    write it and an older deploy keeps working.
--
-- 2. feedback had no DELETE policy, so "Delete all data" (settings/actions.ts
--    deleteAllData, on the user's own client) deleted zero feedback rows under
--    RLS and still reported success.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---- 1. Audit rows survive the admin who wrote them -------------------------
alter table public.admin_audit_log alter column admin_id drop not null;
alter table public.admin_audit_log add column if not exists admin_label text;

update public.admin_audit_log l
   set admin_label = u.email
  from auth.users u
 where u.id = l.admin_id
   and l.admin_label is null;

alter table public.admin_audit_log drop constraint if exists admin_audit_log_admin_id_fkey;
alter table public.admin_audit_log
  add constraint admin_audit_log_admin_id_fkey
  foreign key (admin_id) references auth.users (id) on delete set null;

-- SECURITY DEFINER so it can read auth.users whichever role inserts the row.
-- Always derived from admin_id, so a caller can't record a different name.
create or replace function public.admin_audit_log_set_label()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.admin_id is not null then
    new.admin_label := (select u.email from auth.users u where u.id = new.admin_id);
  end if;
  return new;
end;
$$;

drop trigger if exists admin_audit_log_set_label on public.admin_audit_log;
create trigger admin_audit_log_set_label
  before insert on public.admin_audit_log
  for each row execute function public.admin_audit_log_set_label();

-- ---- 2. The owner can remove their own feedback ------------------------------
drop policy if exists "feedback_owner_delete" on public.feedback;
create policy "feedback_owner_delete" on public.feedback
  for delete to authenticated
  using ((select auth.uid()) = user_id);
