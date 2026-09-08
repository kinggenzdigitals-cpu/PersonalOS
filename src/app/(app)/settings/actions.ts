"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_CARDS } from "@/lib/dashboard-cards";
import { isSchemaMissing, migrationRequired } from "@/lib/supabase/errors";

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

/** Save which dashboard cards this user has switched off. */
export async function updateDashboardPrefs(
  hidden: string[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const valid = new Set(DASHBOARD_CARDS.map((c) => c.key as string));
  const clean = [...new Set(hidden)].filter((k) => valid.has(k));

  const { error } = await supabase
    .from("profiles")
    .update({ dashboard_prefs: { hidden: clean } })
    .eq("user_id", user.id);

  if (error) {
    if (isSchemaMissing(error)) {
      return { ok: false, error: migrationRequired("Dashboard preferences", "0015") };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Every table a user owns rows in, for the "download my data" export. */
const OWNED_TABLES = [
  "profiles",
  "accounts",
  "categories",
  "transactions",
  "transaction_favorites",
  "merchant_categories",
  "budgets",
  "monthly_budgets",
  "bills",
  "bill_payments",
  "ledger_entries",
  "assets",
  "liabilities",
  "savings_goals",
  "habits",
  "habit_logs",
  "mood_entries",
  "tasks",
  "calendar_events",
  "focus_sessions",
  "feedback",
  "subscriptions",
  "promotion_offers",
] as const;

export type DataExport = {
  exportedAt: string;
  tables: Record<string, unknown[]>;
};

export type ExportDataResult =
  | { ok: true; data: DataExport }
  | { ok: false; error: string };

/**
 * A full copy of the user's own data. Available on every plan — this is a
 * personal-data control, not a paid feature. RLS scopes every read to the
 * caller, so no row from another account can be returned.
 */
export async function exportAllData(): Promise<ExportDataResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  // Per-table column allow-lists. `select("*")` on feedback would hand the
  // user the internal `admin_note` — the column 0008 marks "internal; not
  // selected by user-facing queries" and that getMyFeedback deliberately omits.
  const EXPORT_COLUMNS: Partial<Record<(typeof OWNED_TABLES)[number], string>> = {
    feedback:
      "id, category, title, message, screenshot_url, status, admin_response, created_at, updated_at",
  };

  const tables: Record<string, unknown[]> = {};
  for (const table of OWNED_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select(EXPORT_COLUMNS[table] ?? "*");
    // Tolerate tables that don't exist yet (migrations not applied).
    if (error && !isSchemaMissing(error)) {
      return { ok: false, error: `${table}: ${error.message}` };
    }
    tables[table] = data ?? [];
  }

  return {
    ok: true,
    data: { exportedAt: new Date().toISOString(), tables },
  };
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

  // Children before parents (foreign keys). Keep this list in step with
  // /supabase/migrations — a table missing here silently survives a reset.
  const tables = [
    "bill_payments",
    "focus_sessions",
    "transactions",
    "transaction_favorites",
    "merchant_categories",
    "ledger_entries",
    "bills",
    "budgets",
    "monthly_budgets",
    "habit_logs",
    "habits",
    "mood_entries",
    "tasks",
    "calendar_events",
    "assets",
    "liabilities",
    "savings_goals",
    "feedback",
    "accounts",
  ] as const;

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", user.id);
    // Tolerate tables that don't exist yet (migrations not applied).
    if (error && !isSchemaMissing(error)) {
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
