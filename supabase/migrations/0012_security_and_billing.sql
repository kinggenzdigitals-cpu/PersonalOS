begin;

-- Security history visible only to the account owner. Events are written
-- through a constrained RPC so callers cannot create records for other users.
create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'login_success',
      'password_changed',
      'data_exported',
      'tracking_data_deleted'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index security_events_user_created_idx
  on public.security_events (user_id, created_at desc);

alter table public.security_events enable row level security;

create policy "security_events_owner_read" on public.security_events
  for select to authenticated
  using (auth.uid() = user_id);

grant select on public.security_events to authenticated;

create or replace function public.record_security_event(
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_event_type not in (
    'login_success',
    'password_changed',
    'data_exported',
    'tracking_data_deleted'
  ) then
    raise exception 'Unsupported security event';
  end if;

  insert into public.security_events (user_id, event_type, metadata)
  values (
    v_user_id,
    p_event_type,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.record_security_event(text, jsonb) from public;
revoke all on function public.record_security_event(text, jsonb) from anon;
grant execute on function public.record_security_event(text, jsonb) to authenticated;

-- Minimal, privacy-safe error monitoring. It stores only a server-generated
-- digest and route, never the error message, stack, form values, or money data.
create table public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  error_digest text,
  route text not null,
  created_at timestamptz not null default now()
);

create index app_error_events_created_idx
  on public.app_error_events (created_at desc);
create index app_error_events_user_created_idx
  on public.app_error_events (user_id, created_at desc);

alter table public.app_error_events enable row level security;

create or replace function public.record_app_error(
  p_error_digest text,
  p_route text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_recent_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select count(*)::integer
  into v_recent_count
  from public.app_error_events
  where user_id = v_user_id
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 20 then
    return;
  end if;

  insert into public.app_error_events (user_id, error_digest, route)
  values (
    v_user_id,
    nullif(left(coalesce(p_error_digest, ''), 120), ''),
    left(coalesce(nullif(p_route, ''), '/unknown'), 240)
  );
end;
$$;

revoke all on function public.record_app_error(text, text) from public;
revoke all on function public.record_app_error(text, text) from anon;
grant execute on function public.record_app_error(text, text) to authenticated;

-- Delete tracking records as one transaction. The login, profile, categories,
-- plan, and security history remain until the user deletes the whole account.
create or replace function public.delete_my_tracking_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.bill_payments where user_id = v_user_id;
  delete from public.savings_goal_contributions where user_id = v_user_id;
  delete from public.monthly_goal_allocations where user_id = v_user_id;
  delete from public.transactions where user_id = v_user_id;
  delete from public.ledger_entries where user_id = v_user_id;
  delete from public.monthly_category_budgets where user_id = v_user_id;
  delete from public.monthly_budget_plans where user_id = v_user_id;
  delete from public.budgets where user_id = v_user_id;
  delete from public.bills where user_id = v_user_id;
  delete from public.habit_logs where user_id = v_user_id;
  delete from public.focus_sessions where user_id = v_user_id;
  delete from public.habits where user_id = v_user_id;
  delete from public.mood_entries where user_id = v_user_id;
  delete from public.tasks where user_id = v_user_id;
  delete from public.calendar_events where user_id = v_user_id;
  delete from public.assets where user_id = v_user_id;
  delete from public.liabilities where user_id = v_user_id;
  delete from public.savings_goals where user_id = v_user_id;
  delete from public.feedback where user_id = v_user_id;
  delete from public.accounts where user_id = v_user_id;

  update public.profiles
  set onboarded = false
  where user_id = v_user_id;
end;
$$;

revoke all on function public.delete_my_tracking_data() from public;
revoke all on function public.delete_my_tracking_data() from anon;
grant execute on function public.delete_my_tracking_data() to authenticated;

-- Expired and duplicate active promo rows are cleaned before enforcing one
-- active offer per user. The partial index closes concurrent-claim races.
update public.promotion_offers
set status = 'expired'
where status = 'active'
  and expires_at <= now();

with ranked as (
  select
    id,
    row_number() over (partition by user_id order by created_at desc, id desc) as row_number
  from public.promotion_offers
  where status = 'active'
)
update public.promotion_offers as offer
set status = 'expired'
from ranked
where offer.id = ranked.id
  and ranked.row_number > 1;

create unique index promotion_offers_one_active_per_user_idx
  on public.promotion_offers (user_id)
  where status = 'active';

-- Server-owned checkout ledger. It stores the amount and plan selected before
-- the user is sent to Xendit, so the callback never trusts plan details from
-- the callback URL or external ID.
create table public.payment_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('pro', 'premium')),
  billing_period text not null check (
    billing_period in ('monthly', 'quarterly', 'semiannual', 'annual')
  ),
  period_months integer not null check (period_months in (1, 3, 6, 12)),
  expected_amount numeric(12, 2) not null check (expected_amount > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'failed', 'expired')
  ),
  provider_invoice_id text unique,
  provider_invoice_url text,
  promotion_offer_id uuid references public.promotion_offers (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_checkout_sessions_user_created_idx
  on public.payment_checkout_sessions (user_id, created_at desc);
create index payment_checkout_sessions_status_created_idx
  on public.payment_checkout_sessions (status, created_at);

create trigger payment_checkout_sessions_set_updated_at
  before update on public.payment_checkout_sessions
  for each row execute function public.set_updated_at();

alter table public.payment_checkout_sessions enable row level security;

create policy "payment_checkout_sessions_owner_read"
  on public.payment_checkout_sessions
  for select to authenticated
  using (auth.uid() = user_id);

grant select on public.payment_checkout_sessions to authenticated;

-- Called only by the service role after the verified Xendit callback. Row
-- locking and the paid status make repeat callbacks idempotent.
create or replace function public.complete_payment_checkout(
  p_external_id text,
  p_provider_invoice_id text,
  p_paid_amount numeric,
  p_currency text,
  p_paid_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout public.payment_checkout_sessions%rowtype;
  v_current_end timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  select *
  into v_checkout
  from public.payment_checkout_sessions
  where external_id = p_external_id
  for update;

  if not found then
    raise exception 'Unknown checkout';
  end if;

  if v_checkout.status = 'paid' then
    return 'duplicate';
  end if;

  if v_checkout.status <> 'pending' then
    raise exception 'Checkout is not payable';
  end if;

  if p_paid_amount is null
     or p_paid_amount <> v_checkout.expected_amount
     or p_currency <> v_checkout.currency then
    raise exception 'Payment does not match checkout';
  end if;

  select current_period_end
  into v_current_end
  from public.subscriptions
  where user_id = v_checkout.user_id
  for update;

  v_period_start := greatest(now(), coalesce(v_current_end, now()));
  v_period_end := v_period_start + make_interval(months => v_checkout.period_months);

  insert into public.subscriptions (
    user_id,
    plan,
    status,
    interval,
    access_type,
    xendit_customer_id,
    current_period_end
  )
  values (
    v_checkout.user_id,
    v_checkout.plan,
    'active'::public.subscription_status,
    v_checkout.billing_period,
    'paid'::public.access_type,
    p_provider_invoice_id,
    v_period_end
  )
  on conflict (user_id) do update
  set plan = excluded.plan,
      status = excluded.status,
      interval = excluded.interval,
      access_type = excluded.access_type,
      xendit_customer_id = excluded.xendit_customer_id,
      current_period_end = excluded.current_period_end;

  update public.payment_checkout_sessions
  set status = 'paid',
      provider_invoice_id = coalesce(p_provider_invoice_id, provider_invoice_id),
      paid_at = coalesce(p_paid_at, now())
  where id = v_checkout.id;

  if v_checkout.promotion_offer_id is not null then
    update public.promotion_offers
    set status = 'redeemed'
    where id = v_checkout.promotion_offer_id
      and user_id = v_checkout.user_id
      and status = 'active';
  end if;

  return 'activated';
end;
$$;

revoke all on function public.complete_payment_checkout(text, text, numeric, text, timestamptz) from public;
revoke all on function public.complete_payment_checkout(text, text, numeric, text, timestamptz) from anon;
revoke all on function public.complete_payment_checkout(text, text, numeric, text, timestamptz) from authenticated;
grant execute on function public.complete_payment_checkout(text, text, numeric, text, timestamptz) to service_role;

-- A simple application-owned marker that the admin dashboard can compare with
-- the code's expected schema release. Supabase's internal migration table is
-- intentionally not exposed to the application.
create table public.app_schema_versions (
  version integer primary key,
  description text not null,
  applied_at timestamptz not null default now()
);

alter table public.app_schema_versions enable row level security;
insert into public.app_schema_versions (version, description)
values (12, 'Security history, error monitoring, data controls, and verified billing ledger');

commit;
