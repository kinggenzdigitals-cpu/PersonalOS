"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function changeOwnPassword(
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };

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
