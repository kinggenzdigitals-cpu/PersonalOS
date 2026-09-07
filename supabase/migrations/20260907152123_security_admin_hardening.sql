begin;

-- Requires 0001-0012. Do not run this on an unbaselined live database.
-- Trigger execution continues normally after revoking direct RPC access.
alter function public.set_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = '';
alter function public.protect_profile_privileged() set search_path = '';
alter function public.is_super_admin() set search_path = '';
revoke execute on function public.set_updated_at(), public.handle_new_user(),
  public.protect_profile_privileged() from public, anon, authenticated;
revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- An UPDATE trigger cannot stop deleting and re-creating a profile with an
-- elevated role. Only Auth's signup trigger or the trusted server creates it.
drop policy "profiles_owner_all" on public.profiles;
create policy "profiles_owner_read" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_owner_update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, currency, timezone, week_starts_on, onboarded,
  low_balance_threshold, username, last_login_at) on public.profiles to authenticated;

-- Make Data API grants explicit instead of relying on project defaults.
-- These tracking tables already have owner checks in both USING/WITH CHECK.
grant select, insert, update, delete on public.accounts, public.categories,
  public.transactions, public.budgets, public.bills, public.bill_payments,
  public.habits, public.habit_logs, public.mood_entries, public.tasks,
  public.calendar_events, public.ledger_entries, public.assets, public.liabilities,
  public.savings_goals, public.focus_sessions, public.monthly_category_budgets,
  public.monthly_budget_plans, public.monthly_goal_allocations,
  public.savings_goal_contributions to authenticated;
grant select on public.account_balances to authenticated;
alter view public.account_balances set (security_invoker = true);

-- Keep internal feedback notes inaccessible through the Data API, including
-- direct requests outside the UI. The admin uses the authorized server client.
drop policy "feedback_admin_update" on public.feedback;
drop policy "feedback_select" on public.feedback;
create policy "feedback_owner_read" on public.feedback
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.feedback from public, anon, authenticated;
grant select (id, user_id, category, title, message, screenshot_url, status,
  admin_response, is_duplicate, archived, created_at, updated_at)
  on public.feedback to authenticated;
grant insert (user_id, category, title, message, screenshot_url)
  on public.feedback to authenticated;

-- Invitation validation is handled by the server. The previous owner policy
-- queried auth.users, which signed-in Data API callers cannot read.
drop policy "invitations_own_select" on public.user_invitations;
drop policy "invitations_admin_all" on public.user_invitations;
revoke all on public.user_invitations, public.admin_audit_log,
  public.app_error_events, public.app_schema_versions
  from public, anon, authenticated;

revoke all on public.subscriptions, public.promotion_offers,
  public.security_events, public.payment_checkout_sessions
  from public, anon, authenticated;
grant select on public.subscriptions, public.promotion_offers,
  public.security_events, public.payment_checkout_sessions to authenticated;

-- RLS bypass alone does not grant table privileges on new Supabase projects.
grant select, insert, update, delete on public.profiles, public.subscriptions,
  public.feedback, public.user_invitations, public.admin_audit_log,
  public.app_error_events, public.app_schema_versions, public.security_events,
  public.payment_checkout_sessions, public.promotion_offers to service_role;

insert into public.app_schema_versions(version, description)
values (13, 'Explicit Data API privileges, protected profiles, and private admin data');

commit;
