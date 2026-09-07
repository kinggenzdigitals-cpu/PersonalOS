-- ============================================================================
-- Finance & Habit Tracker — 0021 Bank reconciliation
--
-- 0020's fingerprint stops the same STATEMENT being imported twice. It cannot
-- catch the other overlap: a bank row that duplicates a transaction the user
-- already entered by hand.
--
--   Manual : "Shell Fuel"             ₱2,000  Sept 5
--   Import : "SHELL SERVICE STATION"  ₱2,000  Sept 5
--
-- Those are one real-world purchase recorded twice. Reconciliation surfaces
-- the pair and lets the user decide; nothing is merged or deleted on its own.
--
-- `reconciled_at` records that a row has been reviewed, so a pair the user
-- deliberately kept as two separate transactions stops being suggested. One
-- nullable column rather than a pair table — a reviewed row simply drops out
-- of the candidate set.
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.transactions
  add column if not exists reconciled_at timestamptz;

-- Finding unreviewed imported rows is the hot path for the review screen.
create index if not exists transactions_unreconciled_idx
  on public.transactions (user_id, occurred_at desc)
  where import_fingerprint is not null and reconciled_at is null;
