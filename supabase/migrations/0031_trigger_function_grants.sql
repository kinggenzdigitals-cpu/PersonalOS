-- ============================================================================
-- Finance & Habit Tracker — 0031 Trigger functions are not part of the API
--
-- 0028 and 0029 added two SECURITY DEFINER trigger functions without revoking
-- the EXECUTE that Postgres grants to PUBLIC by default, so both were reachable
-- as /rest/v1/rpc/<name> by anon and by any signed-in user. A direct call can't
-- do damage (Postgres refuses to run a trigger function outside a trigger), but
-- they are not API surface and should not be advertised as such.
--
-- Safe: a trigger fires its function without checking the calling role's
-- EXECUTE privilege. Verified against this database before applying — with
-- EXECUTE revoked from public, anon and authenticated, an UPDATE issued as
-- `authenticated` through RLS still ran set_updated_at() and moved updated_at.
-- The service-role client, which is what actually writes these tables, owns
-- the functions and keeps EXECUTE regardless.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- Fills admin_audit_log.admin_label from admin_id (0028).
revoke all on function public.admin_audit_log_set_label() from public, anon, authenticated;

-- Serialises promo redemptions against max_redemptions (0029).
revoke all on function public.enforce_promo_redemption_cap() from public, anon, authenticated;
