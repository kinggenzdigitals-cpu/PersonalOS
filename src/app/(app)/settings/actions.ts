"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
