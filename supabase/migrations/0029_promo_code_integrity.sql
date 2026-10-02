-- ============================================================================
-- Finance & Habit Tracker — 0029 Promo code integrity
--
-- 1. promo_redemptions.user_id was `on delete cascade`, and max_redemptions is
--    enforced by counting rows. Deleting an account deleted its redemption and
--    freed the slot, so one code could be granted more times than its cap. The
--    row now survives with user_id nulled (like billing_events, 0016) and keeps
--    counting. deleteAccount() cancels unpaid holds and redacts the reference.
--
-- 2. The cap was a COUNT followed by a separate INSERT, so concurrent
--    redeemers from different accounts could all pass it. A BEFORE trigger now
--    locks the promo_codes row and recounts, so they serialise and the loser
--    gets 'promo_cap_reached'.
--
-- 3. promo_redeem_attempts: redeemPromoCode() throttles code guessing per
--    account (and across accounts) from this table. Service role only.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---- 1. Redemptions outlive the account --------------------------------------
alter table public.promo_redemptions alter column user_id drop not null;

alter table public.promo_redemptions drop constraint if exists promo_redemptions_user_id_fkey;
alter table public.promo_redemptions
  add constraint promo_redemptions_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

-- ---- 2. The cap holds under concurrency --------------------------------------
-- Only TAKING a slot is capped: inserting a pending/active row, or moving a
-- released one (expired/canceled) back to pending/active. A row that already
-- holds a slot (pending -> active, when a payment lands) is never refused.
create or replace function public.enforce_promo_redemption_cap()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  cap int;
  used int;
begin
  if new.status not in ('pending', 'active') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('pending', 'active') then
    return new;
  end if;

  -- Concurrent redeemers of one code queue here; each recount then runs on a
  -- fresh snapshot that includes the rows the others committed.
  select max_redemptions into cap
    from public.promo_codes
   where id = new.promo_code_id
     for no key update;

  if cap is null then
    return new;
  end if;

  select count(*) into used
    from public.promo_redemptions
   where promo_code_id = new.promo_code_id
     and status in ('pending', 'active')
     and id <> new.id;

  if used >= cap then
    raise exception 'promo_cap_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists promo_redemptions_enforce_cap on public.promo_redemptions;
create trigger promo_redemptions_enforce_cap
  before insert or update of status on public.promo_redemptions
  for each row execute function public.enforce_promo_redemption_cap();

-- ---- 3. Redeem attempts, for throttling --------------------------------------
create table if not exists public.promo_redeem_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Set once the code turned out to exist and be redeemable. The cross-account
  -- ceiling counts only the rest: guesses.
  valid_code boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists promo_redeem_attempts_user_idx
  on public.promo_redeem_attempts (user_id, attempted_at desc);

create index if not exists promo_redeem_attempts_invalid_idx
  on public.promo_redeem_attempts (attempted_at desc)
  where not valid_code;

-- RLS on with no policies: read and written only by the service-role client
-- in redeemPromoCode(). A user must not be able to clear their own throttle.
alter table public.promo_redeem_attempts enable row level security;
