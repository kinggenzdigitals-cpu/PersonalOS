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

/**
 * Plain-language text for a failed database call, for a user-facing action
 * result.
 *
 * PostgREST's error.message is written for developers ("numeric field
 * overflow", "new row violates row-level security policy for table ..."), so
 * passing it to a toast told the user nothing they could act on and named
 * tables and constraints along the way. Known SQLSTATEs get specific copy;
 * anything else gets the caller's action-specific `fallback`.
 *
 * The raw code and message are logged server-side. `details` and `hint` are
 * left out on purpose: that is where Postgres echoes the offending row's values.
 */
export function friendlyDbError(error: MaybeError, fallback: string): string {
  if (!error) return fallback;
  console.error("[db]", fallback, error.code ?? "", error.message ?? "");

  if (isSchemaMissing(error)) {
    return "This feature isn't set up on the database yet. Please try again later.";
  }
  switch (error.code) {
    case "22003": // numeric_value_out_of_range — past numeric(12,2)
      return "That amount is too large.";
    case "23505": // unique_violation
      return "That already exists.";
    case "23503": // foreign_key_violation — deleting a row others point at, or
      // pointing at a row that's gone. Postgres words the first "update or
      // delete on table ...", the second "insert or update on table ...".
      return /update or delete on table/i.test(error.message ?? "")
        ? "This is still in use elsewhere, so it can't be removed."
        : "Something this refers to no longer exists. Refresh and try again.";
    case "23502": // not_null_violation
    case "23514": // check_violation
    case "22P02": // invalid_text_representation (bad enum, uuid or number)
      return "One of the values isn't valid. Check it and try again.";
    case "42501": // insufficient_privilege, including an RLS refusal
      return "You don't have permission to do that.";
    default:
      return fallback;
  }
}
