"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_CARDS } from "@/lib/dashboard-cards";
import { isSchemaMissing, migrationRequired } from "@/lib/supabase/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/entitlement";

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
  // Bank-statement uploads: filename, row counts, which account. Owner-scoped
  // under RLS (0020), so the user can read it; leaving it out made the export
  // an incomplete copy.
  "import_batches",
] as const;

export type DataExport = {
  exportedAt: string;
  /** The account the file belongs to. Lives in auth.users, not profiles, so
   *  nothing in the table dump identifies whose data this is without it. */
  account: { email: string | null; createdAt: string };
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
    data: {
      exportedAt: new Date().toISOString(),
      account: { email: user.email ?? null, createdAt: user.created_at },
      tables,
    },
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
    // Uploaded bank-statement filenames survived a "delete all data" reset.
    // The row is the user's own (0020 owner policy), so deleting it here is
    // both permitted and what the button promises.
    "import_batches",
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

/**
 * Permanently deletes the account itself, not just its rows.
 *
 * Why this exists: the privacy policy promises users can "delete your entire
 * account at any time", and until now nothing could. `deleteAllData()` above
 * keeps the login and only clears owned rows — a data reset, not a deletion.
 *
 * WHAT THE DATABASE DOES FOR US, AND WHAT IT DOESN'T
 *
 * 25 tables carry `references auth.users (id) on delete cascade`, so removing
 * the auth user takes every one of them with it — accounts, transactions,
 * habits, mood entries (journal and prayer_requests included), tasks, budgets,
 * bills, goals, assets, liabilities, subscriptions, feedback, the profile.
 *
 * Five columns are `on delete set null` instead, and THAT is the trap: those
 * rows SURVIVE with the foreign key nulled, while the personal data sitting in
 * their other columns stays exactly where it was. Nulling `user_id` is not
 * erasure when the row still carries the person's email address. So the three
 * that actually hold identifiers are scrubbed here, BEFORE the delete:
 *
 *   • admin_audit_log.detail — jsonb written with { email, username, ... }.
 *     target_user_id nulls itself; the email inside detail would not.
 *   • billing_events.external_id — built as `sub_<uuid>_<plan>_<period>_<ts>`,
 *     so the raw user id survives inside a text column. The ROW is kept on
 *     purpose (it is a payment record, and financial records are normally
 *     retained for tax) but the identifier is redacted.
 *   • user_invitations — the invitee's own email and full name.
 *
 * Deliberately NOT scrubbed: admin_audit_log rows where this user was the
 * ADMIN cascade away with them, and invitations they sent to other people keep
 * those other people's data, which is not this user's to erase.
 *
 * Confirmation is the exact email address rather than a password, because it
 * also works for OAuth accounts, which have no password to re-enter.
 */
export async function deleteAccount(
  confirmEmail: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const typed = confirmEmail.trim().toLowerCase();
  const actual = (user.email ?? "").toLowerCase();
  if (!actual || typed !== actual) {
    return {
      ok: false,
      error: "That doesn't match the email on this account.",
    };
  }

  // An owner-allowlisted address regains super admin on its next sign-in, so
  // deleting it would destroy the data and hand the rebuilt account straight
  // back — and if it is the LAST owner, nobody can reach /admin in between.
  // Removing an owner is a deliberate operations task, not a self-service one.
  if (isOwnerEmail(user.email)) {
    return {
      ok: false,
      error:
        "This is an owner account. Remove it from the owner allow-list first, then delete it.",
    };
  }

  const admin = createAdminClient();

  // --- Scrub the PII that `on delete set null` would otherwise leave behind ---

  const { data: auditRows } = await admin
    .from("admin_audit_log")
    .select("id, detail")
    .eq("target_user_id", user.id);

  for (const row of auditRows ?? []) {
    const detail = (row.detail ?? {}) as Record<string, unknown>;
    // Keep the shape and the action history; drop the identifiers.
    for (const key of ["email", "username", "display_name", "displayName"]) {
      if (key in detail) detail[key] = "[deleted]";
    }
    await admin
      .from("admin_audit_log")
      .update({ detail })
      .eq("id", row.id);
  }

  const { data: billingRows } = await admin
    .from("billing_events")
    .select("id, external_id")
    .eq("user_id", user.id);

  for (const row of billingRows ?? []) {
    if (!row.external_id?.includes(user.id)) continue;
    await admin
      .from("billing_events")
      .update({ external_id: row.external_id.replace(user.id, "[deleted]") })
      .eq("id", row.id);
  }

  if (user.email) {
    await admin.from("user_invitations").delete().ilike("email", user.email);
  }

  // --- Then remove the account, which cascades the 25 owned tables ----------

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return {
      ok: false,
      error: `Couldn't delete the account: ${error.message}`,
    };
  }

  // The session is dead server-side; clear the cookie so the browser agrees.
  await supabase.auth.signOut();
  return { ok: true };
}
