-- ============================================================================
-- Finance & Habit Tracker — 0009 Super Admin email invitations
-- Complimentary-access invitations: hashed one-time token, expiry, status.
-- ============================================================================

create type invitation_status as enum
  ('pending', 'accepted', 'expired', 'revoked');

create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  selected_plan text not null default 'pro',      -- 'pro' | 'premium'
  access_type access_type not null default 'complimentary_pro',
  access_expires_at timestamptz,                  -- null = no expiration
  token_hash text not null,                        -- sha-256 of the raw token
  invitation_expires_at timestamptz not null,
  status invitation_status not null default 'pending',
  invited_by uuid references auth.users (id) on delete set null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_invitations_email_idx on public.user_invitations (lower(email));
create index user_invitations_status_idx on public.user_invitations (status);
create index user_invitations_token_idx on public.user_invitations (token_hash);

create trigger user_invitations_set_updated_at
  before update on public.user_invitations
  for each row execute function public.set_updated_at();

alter table public.user_invitations enable row level security;

-- Super admin manages everything.
create policy "invitations_admin_all" on public.user_invitations
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- An invited user may read the invitation addressed to their own email.
create policy "invitations_own_select" on public.user_invitations
  for select to authenticated
  using (
    lower(email) = lower(
      (select email from auth.users where id = auth.uid())
    )
  );
-- Token validation + acceptance happen through the service role (bypasses RLS).
