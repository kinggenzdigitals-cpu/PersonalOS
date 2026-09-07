"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Stamps profiles.last_login_at for the signed-in user. Called right after a
 * successful sign-in (password and OAuth). Deliberately minimal: we record the
 * time only — no IP, no device fingerprint — so there is nothing sensitive to
 * leak, and it is best-effort (a failure must never block signing in).
 */
export async function recordLogin(): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("user_id", user.id);
  } catch {
    // Never surface a login-history failure to the user.
  }
}
