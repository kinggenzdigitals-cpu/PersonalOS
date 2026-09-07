import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSchemaMissing } from "@/lib/supabase/errors";

/**
 * Reconciles the two super-admin models.
 *
 * The app grants super admin by DB role OR by a confirmed bootstrap email; the
 * database's `is_super_admin()` (used by every admin RLS policy) only knows
 * about `profiles.role`. An email-bootstrapped owner therefore passed app
 * checks while RLS denied them — masked only because the admin screens read
 * through the service-role client.
 *
 * Promotion is tagged `role_source = 'bootstrap'` so it can be withdrawn again
 * when the email leaves the allow-list. A role granted any other way is
 * 'manual' and is never touched automatically.
 *
 * Idempotent and best-effort: if the service-role key isn't configured the app
 * still works through the email path.
 *
 * Only ever called for an email already verified against the owner allow-list.
 */
export async function ensureSuperAdminRole(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();

    // Filter on role_source, NOT on role. Filtering `.neq("role","super_admin")`
    // meant an account that was already an admin could never be tagged, so the
    // self-revoke had no subjects: every pre-existing admin stays untagged (or
    // 'manual' from the 0018 backfill) forever. Keying on "untagged" instead
    // also repairs a promotion that landed before 0018 was applied.
    //
    // `.is("role_source", null)` deliberately skips 'manual' grants — a
    // deliberate administrator is never converted into a revocable one.
    //
    // `select()` so a zero-row update is reported as a failure rather than a
    // silent success — otherwise the app/RLS split this function exists to
    // close would stay open unnoticed.
    let { data, error } = await admin
      .from("profiles")
      .update({ role: "super_admin", role_source: "bootstrap" })
      .eq("user_id", userId)
      .is("role_source", null)
      .select("user_id");

    // role_source arrives with migration 0018 — still promote without it. The
    // row stays untagged, and the caller re-runs this once 0018 lands (see the
    // `roleSource === null` condition in getEntitlement), so it self-repairs.
    if (isSchemaMissing(error)) {
      ({ data, error } = await admin
        .from("profiles")
        .update({ role: "super_admin" })
        .eq("user_id", userId)
        .neq("role", "super_admin")
        .select("user_id"));
    }

    if (error) {
      console.error("[admin] super-admin role sync failed", error.code);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch {
    // Admin client not configured — leave the app-level grant in place.
    return false;
  }
}

/**
 * Withdraw a super-admin role that was granted automatically from the email
 * allow-list, once that email is no longer on it.
 *
 * Scoped to `role_source = 'bootstrap'`: a manually granted administrator is
 * never demoted by a config change. Returns true when a row was actually
 * demoted, so the caller can drop admin for the current request too.
 */
export async function revokeBootstrapSuperAdmin(
  userId: string,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({ role: "user", role_source: null })
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .eq("role_source", "bootstrap")
      .select("user_id");

    // Without 0018 there is no way to tell a bootstrap grant from a manual one,
    // so do nothing rather than risk demoting a real administrator.
    if (error) {
      if (!isSchemaMissing(error)) {
        console.error("[admin] bootstrap demotion failed", error.code);
      }
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
