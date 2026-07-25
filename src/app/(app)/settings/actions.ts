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

  const tables = [
    "bill_payments",
    "transactions",
    "ledger_entries",
    "bills",
    "budgets",
    "habit_logs",
    "habits",
    "mood_entries",
    "tasks",
    "calendar_events",
    "assets",
    "liabilities",
    "savings_goals",
    "accounts",
  ] as const;

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", user.id);
    // Tolerate tables that don't exist yet (migrations not applied) — 42P01.
    if (error && error.code !== "42P01") {
      return { ok: false, error: `${table}: ${error.message}` };
    }
  }

  // Send them back through onboarding (categories + profile are kept).
  await supabase
    .from("profiles")
    .update({ onboarded: false })
    .eq("user_id", user.id);

  revalidatePath("/", "layout");
  return { ok: true };
}
