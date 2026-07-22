-- ============================================================================
-- Life OS — 0003 Receivables & Payables (ledger)
-- Tracks money owed TO the user (receivable) and money the user OWES (payable).
-- Settling an entry creates an income/expense transaction (see app actions).
-- ============================================================================

create type ledger_direction as enum ('receivable', 'payable');
create type ledger_status as enum ('open', 'settled');

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  direction ledger_direction not null,
  party text not null,
  amount numeric(12, 2) not null check (amount > 0),
  due_date date,
  status ledger_status not null default 'open',
  account_id uuid references public.accounts (id) on delete set null,
  settled_transaction_id uuid references public.transactions (id) on delete set null,
  settled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ledger_entries_user_idx
  on public.ledger_entries (user_id, direction, status);
create index ledger_entries_due_idx
  on public.ledger_entries (user_id, due_date);

create trigger ledger_entries_set_updated_at
  before update on public.ledger_entries
  for each row execute function public.set_updated_at();

-- Row Level Security -------------------------------------------------------
alter table public.ledger_entries enable row level security;
create policy "ledger_entries_owner_all" on public.ledger_entries
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
