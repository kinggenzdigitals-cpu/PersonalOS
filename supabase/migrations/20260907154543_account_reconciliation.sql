begin;

-- Manual comparisons are user-entered observations, never bank-verified data.
alter table public.accounts add constraint accounts_owner_id_key unique (user_id, id);
alter table public.transactions add constraint transactions_owner_id_key unique (user_id, id);

create table public.account_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  request_id uuid not null,
  as_of timestamptz not null,
  recorded_balance numeric(14,2) not null,
  observed_balance numeric(14,2) not null,
  difference numeric(14,2) generated always as (observed_balance - recorded_balance) stored,
  apply_adjustment boolean not null default false,
  adjustment_transaction_id uuid,
  notes text check (length(notes) <= 240),
  status text generated always as (
    case when observed_balance = recorded_balance then 'matched'
      when adjustment_transaction_id is not null then 'adjusted'
      else 'needs_review' end
  ) stored,
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  foreign key (user_id, account_id) references public.accounts(user_id, id) on delete cascade,
  foreign key (user_id, adjustment_transaction_id)
    references public.transactions(user_id, id)
    on delete set null (adjustment_transaction_id)
);
create index account_reconciliations_owner_created_idx
  on public.account_reconciliations(user_id, created_at desc);
create index account_reconciliations_account_idx
  on public.account_reconciliations(user_id, account_id);
create index account_reconciliations_adjustment_idx
  on public.account_reconciliations(user_id, adjustment_transaction_id);
alter table public.account_reconciliations enable row level security;
create policy "reconciliation_owner_read" on public.account_reconciliations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reconciliation_owner_insert" on public.account_reconciliations
  for insert to authenticated with check ((select auth.uid()) = user_id);
revoke all on public.account_reconciliations from public, anon, authenticated;
grant select, insert on public.account_reconciliations to authenticated;
grant select, insert, update, delete on public.account_reconciliations to service_role;

-- Serialize account balance changes with reconciliation. A transaction edit,
-- transfer, deletion, or opening-balance edit cannot race the final comparison.
create function public.lock_transaction_accounts()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_ids uuid[];
  v_owner uuid;
  v_count integer;
  v_locked integer;
begin
  if tg_op = 'INSERT' then
    v_ids := array[new.account_id, new.to_account_id];
    v_owner := new.user_id;
  elsif tg_op = 'DELETE' then
    v_ids := array[old.account_id, old.to_account_id];
    v_owner := old.user_id;
  else
    if new.user_id is distinct from old.user_id then
      raise exception 'Transaction ownership cannot be changed';
    end if;
    v_ids := array[old.account_id, old.to_account_id, new.account_id, new.to_account_id];
    v_owner := new.user_id;
  end if;
  select array_agg(distinct id), count(distinct id) into v_ids, v_count
    from unnest(v_ids) id where id is not null;
  perform id from public.accounts
    where user_id = v_owner and id = any(v_ids) order by id for update;
  get diagnostics v_locked = row_count;
  -- Cascading deletion can reach a child after its parent account is gone.
  if tg_op <> 'DELETE' and v_locked <> v_count then
    raise exception 'Account is unavailable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.lock_transaction_accounts() from public, anon, authenticated;
create trigger transactions_lock_accounts before insert or update or delete
  on public.transactions for each row execute function public.lock_transaction_accounts();

create function public.get_recorded_account_balance(p_account_id uuid, p_as_of timestamptz)
returns numeric language sql stable security invoker set search_path = '' as $$
  select a.opening_balance + coalesce((
    select sum(case
      when t.type = 'income' then t.amount
      when t.type = 'expense' then -t.amount
      when t.type = 'transfer' and t.account_id = a.id then -t.amount
      when t.type = 'transfer' and t.to_account_id = a.id then t.amount
      when t.type = 'adjustment' and t.direction = 'in' then t.amount
      when t.type = 'adjustment' and t.direction = 'out' then -t.amount
      else 0 end)
    from public.transactions t
    where t.user_id = a.user_id and (t.account_id = a.id or t.to_account_id = a.id)
      and t.occurred_at <= p_as_of
  ), 0)
  from public.accounts a
  where a.id = p_account_id and a.user_id = (select auth.uid()) and not a.archived
    and exists (select 1 from public.profiles p where p.user_id = a.user_id and p.status = 'active');
$$;
revoke all on function public.get_recorded_account_balance(uuid,timestamptz) from public, anon;
grant execute on function public.get_recorded_account_balance(uuid,timestamptz) to authenticated;

create function public.record_account_reconciliation(
  p_request_id uuid, p_account_id uuid, p_as_of timestamptz,
  p_expected_balance numeric, p_observed_balance numeric,
  p_apply_adjustment boolean default false, p_notes text default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_balance numeric;
  v_difference numeric;
  v_transaction uuid;
  v_existing public.account_reconciliations%rowtype;
  v_result public.account_reconciliations%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_account_id is null or p_as_of is null
    or p_expected_balance is null or p_observed_balance is null or p_apply_adjustment is null
    or p_expected_balance::text in ('NaN','Infinity','-Infinity')
    or p_observed_balance::text in ('NaN','Infinity','-Infinity')
    or abs(p_observed_balance) > 9999999999.99
    or p_expected_balance <> round(p_expected_balance,2)
    or p_observed_balance <> round(p_observed_balance,2)
    or length(coalesce(p_notes,'')) > 240 then
    raise exception 'Invalid comparison';
  end if;
  perform id from public.accounts where id = p_account_id and user_id = v_user and not archived for update;
  if not found then raise exception 'Account is unavailable'; end if;
  select * into v_existing from public.account_reconciliations
    where user_id = v_user and request_id = p_request_id;
  if found then
    if v_existing.account_id <> p_account_id or v_existing.as_of <> p_as_of
      or v_existing.observed_balance <> p_observed_balance
      or v_existing.recorded_balance <> p_expected_balance
      or v_existing.apply_adjustment <> p_apply_adjustment
      or coalesce(v_existing.notes,'') <> coalesce(nullif(trim(p_notes),''),'') then
      raise exception 'Comparison request was already used';
    end if;
    return to_jsonb(v_existing);
  end if;
  if p_as_of > now() or p_as_of < now() - interval '15 minutes' then
    raise exception 'Preview expired. Compare again';
  end if;
  v_balance := public.get_recorded_account_balance(p_account_id,p_as_of);
  if v_balance is null then raise exception 'Account is unavailable'; end if;
  if v_balance <> p_expected_balance then
    raise exception 'Recorded balance changed. Compare again';
  end if;
  v_difference := p_observed_balance - v_balance;
  if p_apply_adjustment and v_difference <> 0 then
    if nullif(trim(p_notes),'') is null then raise exception 'Add a reason for the adjustment'; end if;
    if abs(v_difference) > 9999999999.99 then raise exception 'Difference exceeds the adjustment limit'; end if;
    insert into public.transactions(user_id,account_id,type,amount,direction,occurred_at,notes)
    values(v_user,p_account_id,'adjustment',abs(v_difference),
      case when v_difference > 0 then 'in'::public.adjustment_direction else 'out'::public.adjustment_direction end,
      p_as_of,'Manual balance comparison: ' || trim(p_notes)) returning id into v_transaction;
  end if;
  insert into public.account_reconciliations(user_id,account_id,request_id,as_of,
    recorded_balance,observed_balance,apply_adjustment,adjustment_transaction_id,notes)
  values(v_user,p_account_id,p_request_id,p_as_of,v_balance,p_observed_balance,
    p_apply_adjustment,v_transaction,nullif(trim(p_notes),'')) returning * into v_result;
  return to_jsonb(v_result);
end;
$$;
revoke all on function public.record_account_reconciliation(uuid,uuid,timestamptz,numeric,numeric,boolean,text) from public,anon;
grant execute on function public.record_account_reconciliation(uuid,uuid,timestamptz,numeric,numeric,boolean,text) to authenticated;

insert into public.app_schema_versions(version,description)
values(14,'Manual balance comparisons with atomic adjustments and owner isolation');
commit;
