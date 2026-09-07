-- ============================================================================
-- Finance & Habit Tracker — 0017 Subscription lifecycle
--
-- Billing is invoice-based (one-off Xendit invoices, no stored card, no
-- automatic recurring charge). "Cancel" therefore means "do not renew": the
-- user keeps the access they already paid for until current_period_end, and
-- then lapses to Free. Recording the intent explicitly lets the UI tell the
-- truth ("Premium until 3 Nov, then Free") and gives a future auto-renew
-- implementation something to honour.
--
-- No status change on cancel: flipping subscriptions.status to 'canceled'
-- immediately would strip access the user has already paid for, because
-- entitlement requires status = 'active'.
--
-- Written only by the service role (subscriptions has a select-only policy for
-- authenticated users, from 0006).
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz;
