"use server";

import { requireActiveUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyAuthError } from "@/lib/auth-errors";

export async function changeOwnPassword(
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  // GoTrue's updateUser isn't covered by RLS, so this check is the only thing
  // stopping a suspended / revoked session from resetting the password.
  const active = await requireActiveUser();
  if (!active) return { ok: false, error: "You're not signed in." };
  const { supabase, user } = active;

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };

  // Clear the temp-password flag via the service role (users can't change it
  // themselves — a privilege-escalation guard trigger blocks that column).
  try {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("user_id", user.id);
  } catch {
    /* flag stays set; they'll be asked again next login — safe */
  }
  return { ok: true };
}
