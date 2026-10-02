-- ============================================================================
-- Finance & Habit Tracker — 0030 Feedback write bounds
--
-- 1. screenshot_url took any string, and the admin console renders it as a
--    "View screenshot" link, so a user could plant javascript:, data:, http:
--    or an OS protocol-handler link in front of the most privileged account.
--    submitFeedback() now accepts https only, but feedback_insert (0008) lets
--    any signed-in user insert straight through PostgREST, so the rule lives
--    here too: https, no whitespace, at most 2048 characters. Values that don't
--    qualify are cleared first. Otherwise the constraint couldn't be added, and
--    every later triage update of those rows would fail it.
--
-- 2. feedback_admin_update (0008, restated in 0019) only asks
--    is_super_admin(), which is also true for a provisional ('bootstrap')
--    admin, and RLS can't limit columns. Through PostgREST such an admin could
--    rewrite ANY column of anyone's row: move it to another user_id, edit the
--    message, or post an admin_response past the 4000-character cap that
--    updateFeedback() applies. Column privileges now bound the writable set to
--    the triage fields, and a check constraint mirrors the cap.
--    The service role (updateFeedback) is unaffected, and set_updated_at()
--    still works: a trigger's writes to NEW are not privilege-checked.
--
-- 3. feedback_insert (0008) only checks auth.uid() = user_id, and signed-in
--    users held table-wide INSERT. Through PostgREST they could file a row
--    with status, admin_note, admin_response, is_duplicate or archived
--    already set, so a planted "internal note" would read to admins as
--    their own. Inserts are now bounded to the columns submitFeedback()
--    writes; every other column takes its default.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---- 1. Screenshot links are https only -------------------------------------
-- Runs before section 2's constraint exists on a first apply, so clearing a
-- bad link can never trip the admin-text cap.
update public.feedback
   set screenshot_url = null
 where screenshot_url is not null
   and (screenshot_url !~* '^https://[^[:space:]]+$'
        or char_length(screenshot_url) > 2048);

alter table public.feedback drop constraint if exists feedback_screenshot_url_https;
alter table public.feedback
  add constraint feedback_screenshot_url_https
  check (
    screenshot_url is null
    or (screenshot_url ~* '^https://[^[:space:]]+$'
        and char_length(screenshot_url) <= 2048)
  );

-- ---- 2. Admins may only write the triage columns ----------------------------
-- Revoking the table-level privilege also revokes column grants, so this
-- re-runs cleanly. anon has no update policy; it loses the privilege too.
revoke update on public.feedback from anon, authenticated;
grant update (status, admin_note, admin_response, is_duplicate, archived)
  on public.feedback to authenticated;

-- NOT VALID: checked on every new insert or update without re-scanning (and
-- possibly failing on) existing rows.
alter table public.feedback drop constraint if exists feedback_admin_text_len_check;
alter table public.feedback
  add constraint feedback_admin_text_len_check
  check (
    coalesce(char_length(admin_note), 0) <= 4000
    and coalesce(char_length(admin_response), 0) <= 4000
  ) not valid;

-- ---- 3. Users may only fill in the submission columns -----------------------
-- Same pattern as section 2: revoking the table privilege also revokes column
-- grants, so this re-runs cleanly. Matches src/app/(app)/feedback/actions.ts.
revoke insert on public.feedback from anon, authenticated;
grant insert (user_id, category, title, message, screenshot_url)
  on public.feedback to authenticated;
