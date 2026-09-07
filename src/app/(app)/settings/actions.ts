"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SettingsInput = {
  displayName: string;
  currency: string;
  timezone: string;
  weekStartsOn: "monday" | "sunday";
  lowBalanceThreshold: number;
};

export async function updateSettings(
  input: SettingsInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.displayName.trim()) {
    return { ok: false, error: "Enter your name." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName.trim(),
      currency: input.currency,
      timezone: input.timezone,
      week_starts_on: input.weekStartsOn,
      low_balance_threshold: input.lowBalanceThreshold,
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Deletes all of the user's data and resets them to a fresh (un-onboarded)
 * state. Their login is kept — removing the account itself requires elevated
 * privileges and is handled separately. RLS ensures only the user's own rows
 * are touched; children are deleted before parents to respect foreign keys.
 */
export async function deleteAllData(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { error } = await supabase.rpc("delete_my_tracking_data");
  if (error) return { ok: false, error: error.message };

  await supabase.rpc("record_security_event", {
    p_event_type: "tracking_data_deleted",
    p_metadata: {},
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAccount(
  confirmation: string,
): Promise<ActionResult> {
  if (confirmation.trim().toUpperCase() !== "DELETE ACCOUNT") {
    return { ok: false, error: "Type DELETE ACCOUNT to confirm." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).getTime()
    : 0;
  if (!lastSignIn || Date.now() - lastSignIn > 15 * 60 * 1000) {
    return {
      ok: false,
      error: "For security, sign out and sign in again before deleting your account.",
    };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return { ok: false, error: "Couldn't delete the account." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Account deletion isn't available right now." };
  }
}
