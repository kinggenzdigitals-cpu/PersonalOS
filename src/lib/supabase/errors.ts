/**
 * Recognising "this table/column doesn't exist yet" across the two layers that
 * can report it.
 *
 * PostgREST (what Supabase hosts) resolves names against its own schema cache
 * BEFORE the query reaches Postgres, so a missing table returns PGRST205 and a
 * missing column in a write payload returns PGRST204 — NOT the Postgres
 * SQLSTATE 42P01/42703. Checking only the SQLSTATE means every
 * "degrade gracefully until the migration is applied" path silently fails.
 */

type MaybeError = { code?: string | null; message?: string | null } | null;

const MISSING_CODES = new Set([
  "42P01", // undefined_table (Postgres)
  "42703", // undefined_column (Postgres)
  "PGRST205", // table not found in PostgREST schema cache
  "PGRST204", // column not found in PostgREST schema cache
]);

/** True when the error means a table or column hasn't been migrated yet. */
export function isSchemaMissing(error: MaybeError): boolean {
  if (!error) return false;
  if (error.code && MISSING_CODES.has(error.code)) return true;
  const message = error.message?.toLowerCase() ?? "";
  return (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the")
  );
}

/** A friendly "apply the migration" message for a user-facing action result. */
export function migrationRequired(feature: string, migration: string): string {
  return `${feature} isn't set up on the database yet. Apply migration ${migration}, then try again.`;
}
