-- ============================================================================
-- Finance & Habit Tracker — 0020 CSV / bank-statement import
--
-- Phase 5 order: manual accounts → CSV import → reconciliation → provider-ready
-- connection. This is the CSV step.
--
--   • import_batches      — one row per uploaded file, so an import can be
--                           reviewed and (later) reversed as a unit.
--   • transactions.import_batch_id   — which upload created this row.
--   • transactions.import_fingerprint — stable hash of the source line
--     (date + amount + description + account). A partial unique index makes
--     re-importing the same statement a no-op instead of double-posting, which
--     is the single most common way CSV imports corrupt a ledger.
--
-- The fingerprint is nullable and only unique WHERE NOT NULL, so hand-entered
-- transactions are unaffected.
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  source text not null default 'csv',
  filename text,
  row_count integer not null default 0 check (row_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists import_batches_user_idx
  on public.import_batches (user_id, created_at desc);

alter table public.import_batches enable row level security;

drop policy if exists "import_batches_owner_all" on public.import_batches;
create policy "import_batches_owner_all" on public.import_batches
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.owns_account(account_id));

-- ---------------------------------------------------------------------------
-- Link imported rows back to their batch, and make re-imports idempotent.
-- ---------------------------------------------------------------------------

alter table public.transactions
  add column if not exists import_batch_id uuid
    references public.import_batches (id) on delete set null,
  add column if not exists import_fingerprint text;

create index if not exists transactions_import_batch_idx
  on public.transactions (import_batch_id);

-- Partial unique: only imported rows participate, so manual entries (NULL)
-- can still legitimately repeat.
create unique index if not exists transactions_import_fingerprint_key
  on public.transactions (user_id, import_fingerprint)
  where import_fingerprint is not null;
