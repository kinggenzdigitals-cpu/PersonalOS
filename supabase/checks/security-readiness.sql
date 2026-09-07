-- Read-only object inventory. Object presence is NOT proof of migration history.
-- No user records, tokens, passwords, or financial amounts are queried.
with required(migration, kind, object_name, column_name) as (
  values
    ('0001', 'relation', 'public.profiles', null),
    ('0001', 'relation', 'public.account_balances', null),
    ('0003', 'relation', 'public.ledger_entries', null),
    ('0004', 'relation', 'public.assets', null),
    ('0004', 'relation', 'public.liabilities', null),
    ('0005', 'relation', 'public.savings_goals', null),
    ('0006', 'relation', 'public.subscriptions', null),
    ('0007', 'relation', 'public.focus_sessions', null),
    ('0008', 'relation', 'public.feedback', null),
    ('0008', 'relation', 'public.admin_audit_log', null),
    ('0008', 'column', 'public.profiles', 'role'),
    ('0008', 'column', 'public.profiles', 'status'),
    ('0008', 'column', 'public.profiles', 'must_change_password'),
    ('0008', 'column', 'public.subscriptions', 'access_type'),
    ('0009', 'relation', 'public.user_invitations', null),
    ('0010', 'relation', 'public.promotion_offers', null),
    ('0011', 'relation', 'public.monthly_category_budgets', null),
    ('0011', 'relation', 'public.monthly_budget_plans', null),
    ('0011', 'relation', 'public.monthly_goal_allocations', null),
    ('0011', 'relation', 'public.savings_goal_contributions', null),
    ('0012', 'relation', 'public.security_events', null),
    ('0012', 'relation', 'public.app_error_events', null),
    ('0012', 'relation', 'public.payment_checkout_sessions', null),
    ('0012', 'relation', 'public.app_schema_versions', null),
    ('20260907154543', 'relation', 'public.account_reconciliations', null)
), checked as (
  select *, case when kind = 'relation' then to_regclass(object_name) is not null
    else exists (
      select 1 from pg_attribute
      where attrelid = to_regclass(object_name)
        and attname = column_name and not attisdropped
    ) end as present
  from required
)
select migration, bool_and(present) as checked_objects_present,
  coalesce(jsonb_agg(object_name || coalesce('.' || column_name, ''))
    filter (where not present), '[]'::jsonb) as missing_objects
from checked group by migration order by migration;
