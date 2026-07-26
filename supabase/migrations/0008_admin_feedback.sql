-- ============================================================================
-- Finance & Habit Tracker — 0008 Super Admin, entitlements, feedback, audit
-- Adds a server-side owner role, complimentary/lifetime Pro access types, a
-- feedback system, and an admin audit log. Entitlement is decided server-side.
-- ============================================================================

-- ---- Roles + account status ------------------------------------------------
create type user_role as enum ('user', 'super_admin');
create type access_type as enum ('paid', 'complimentary_pro', 'lifetime_pro');
create type account_status as enum ('active', 'suspended', 'revoked');

alter table public.profiles
  add column role user_role not null default 'user',
  add column username text,
  add column status account_status not null default 'active',
  add column must_change_password boolean not null default false,
  add column last_login_at timestamptz;

-- case-insensitive unique usernames
create unique index profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

-- entitlement fields on the existing subscriptions table
alter table public.subscriptions
  add column access_type access_type,
  add column access_expires_at timestamptz,
  add column granted_by uuid references auth.users (id) on delete set null;

-- ---- is_super_admin() helper (used by RLS) ---------------------------------
create or replace function public.is_super_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

-- ---- Prevent privilege escalation ------------------------------------------
-- Normal users (role `authenticated`) can update their own profile for settings
-- but must never change role/status/must_change_password. Only the service role
-- (used by Super Admin server actions) may change those.
create or replace function public.protect_profile_privileged()
  returns trigger
  language plpgsql
as $$
begin
  if current_user <> 'service_role' then
    new.role := old.role;
    new.status := old.status;
    new.must_change_password := old.must_change_password;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileged
  before update on public.profiles
  for each row execute function public.protect_profile_privileged();

-- ---- Feedback --------------------------------------------------------------
create type feedback_category as enum
  ('bug', 'feature', 'recommendation', 'other');
create type feedback_status as enum
  ('new', 'under_review', 'planned', 'in_progress', 'completed', 'declined');

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category feedback_category not null default 'other',
  title text not null,
  message text not null,
  screenshot_url text,
  status feedback_status not null default 'new',
  admin_note text,      -- internal; not selected by user-facing queries
  admin_response text,  -- shown to the submitter
  is_duplicate boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feedback_user_idx on public.feedback (user_id, created_at desc);
create index feedback_status_idx on public.feedback (status);

create trigger feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.set_updated_at();

alter table public.feedback enable row level security;

-- Owner reads their own; super admin reads all.
create policy "feedback_select" on public.feedback
  for select to authenticated
  using (auth.uid() = user_id or public.is_super_admin());

-- Owner can submit for themselves.
create policy "feedback_insert" on public.feedback
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Only super admin can triage (status/notes/response).
create policy "feedback_admin_update" on public.feedback
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---- Admin audit log -------------------------------------------------------
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
create policy "audit_super_admin_read" on public.admin_audit_log
  for select to authenticated
  using (public.is_super_admin());
-- writes happen through the service role (bypasses RLS).
