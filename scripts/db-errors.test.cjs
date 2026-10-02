"use strict";
/**
 * Tests for friendlyDbError, plus a contract check that server actions don't
 * hand raw Supabase error text back to the UI. Compiled to .tmp-test by the
 * "test:db-errors" script, then run on bare node — no dependencies.
 */
const fs = require("node:fs");
const path = require("node:path");

// Capture the server-side log instead of printing it.
const logged = [];
const realConsoleError = console.error;
console.error = (...args) => logged.push(args.map(String).join(" "));

const { friendlyDbError } = require("../.tmp-test/errors.js");

let passed = 0;
let failed = 0;
function eq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    realConsoleError(`  FAIL: ${label}\n    expected ${e}\n    got      ${a}`);
  }
}
function ok(label, condition) {
  eq(label, Boolean(condition), true);
}

const FALLBACK = "Couldn't save this transaction.";

// --- Known SQLSTATEs get specific copy --------------------------------------
eq(
  "22003 numeric overflow",
  friendlyDbError({ code: "22003", message: "numeric field overflow" }, FALLBACK),
  "That amount is too large.",
);
eq(
  "23505 duplicate",
  friendlyDbError(
    { code: "23505", message: 'duplicate key value violates unique constraint "categories_user_kind_name_key"' },
    FALLBACK,
  ),
  "That already exists.",
);
eq(
  "23503 on insert: the referenced row is gone",
  friendlyDbError(
    { code: "23503", message: 'insert or update on table "transactions" violates foreign key constraint "transactions_account_id_fkey"' },
    FALLBACK,
  ),
  "Something this refers to no longer exists. Refresh and try again.",
);
eq(
  "23503 on delete: still referenced",
  friendlyDbError(
    {
      code: "23503",
      message: 'update or delete on table "accounts" violates foreign key constraint "transactions_account_id_fkey" on table "transactions"',
      details: 'Key (id)=(1) is still referenced from table "transactions".',
    },
    FALLBACK,
  ),
  "This is still in use elsewhere, so it can't be removed.",
);
eq(
  "23514 check constraint",
  friendlyDbError(
    { code: "23514", message: 'new row for relation "transactions" violates check constraint "transfer_needs_destination"' },
    FALLBACK,
  ),
  "One of the values isn't valid. Check it and try again.",
);
eq(
  "23502 not null",
  friendlyDbError({ code: "23502", message: 'null value in column "name" of relation "habits"' }, FALLBACK),
  "One of the values isn't valid. Check it and try again.",
);
eq(
  "22P02 bad enum",
  friendlyDbError({ code: "22P02", message: 'invalid input value for enum txn_type: "gift"' }, FALLBACK),
  "One of the values isn't valid. Check it and try again.",
);
eq(
  "42501 RLS refusal",
  friendlyDbError(
    { code: "42501", message: 'new row violates row-level security policy for table "transactions"' },
    FALLBACK,
  ),
  "You don't have permission to do that.",
);
for (const code of ["42P01", "42703", "PGRST205", "PGRST204"]) {
  eq(
    `${code} schema missing`,
    friendlyDbError({ code, message: "x" }, FALLBACK),
    "This feature isn't set up on the database yet. Please try again later.",
  );
}

// --- Everything else falls back to the caller's text ------------------------
eq("unknown code", friendlyDbError({ code: "XX000", message: "internal error" }, FALLBACK), FALLBACK);
eq("no code", friendlyDbError({ message: "fetch failed" }, FALLBACK), FALLBACK);
eq(
  "PGRST116 from .single() keeps a not-found fallback",
  friendlyDbError({ code: "PGRST116", message: "Cannot coerce the result to a single JSON object" }, "Entry not found."),
  "Entry not found.",
);
eq("GoTrue-style code", friendlyDbError({ code: "unexpected_failure", message: "Database error deleting user" }, FALLBACK), FALLBACK);

// --- A missing error returns the fallback and logs nothing --------------------
logged.length = 0;
eq("null error", friendlyDbError(null, "Couldn't start the import."), "Couldn't start the import.");
eq("null error is not logged", logged.length, 0);

// --- The raw error is logged server-side, without details/hint ---------------
logged.length = 0;
friendlyDbError(
  {
    code: "23505",
    message: "duplicate key value violates unique constraint \"x\"",
    details: "Key (email)=(ana@example.com) already exists.",
    hint: "secret-hint",
  },
  FALLBACK,
);
eq("one log line per error", logged.length, 1);
ok("log carries the code", logged[0] && logged[0].includes("23505"));
ok("log carries the raw message", logged[0] && logged[0].includes("duplicate key value"));
ok("log leaves out details (row values)", logged[0] && !logged[0].includes("ana@example.com"));
ok("log leaves out hint", logged[0] && !logged[0].includes("secret-hint"));

// --- Nothing schema-shaped ever reaches the user ----------------------------
const raw = [
  { code: "23514", message: 'new row for relation "transactions" violates check constraint "transfer_needs_destination"' },
  { code: "42501", message: 'new row violates row-level security policy for table "transactions"' },
  { code: "23505", message: 'duplicate key value violates unique constraint "promo_codes_code_key"' },
  { code: "23503", message: 'violates foreign key constraint "bills_account_id_fkey" on table "bills"' },
  { code: "22003", message: "numeric field overflow" },
  { code: "PGRST205", message: "Could not find the table 'public.focus_sessions' in the schema cache" },
  { code: "P0001", message: "some trigger text" },
];
for (const e of raw) {
  const out = friendlyDbError(e, FALLBACK);
  ok(
    `no schema words leak for ${e.code}`,
    !/relation|constraint|policy|schema cache|transactions|promo_codes|bills|focus_sessions|overflow/i.test(out),
  );
}

// --- Contract: server actions route errors through a mapper -------------------
// A raw `x.message` returned from an action lands in a toast verbatim. Allowed:
// friendlyAuthError(x.message), detection like x.message.includes(...), logs,
// and the entries below.
const ALLOWED = [
  // Admin-only; GoTrue's own wording is the clearest thing to show an admin.
  { file: "src/app/(app)/admin/actions.ts", snippet: 'createErr?.message ?? "Couldn\'t create user."' },
];
const RAW = /\b(?:error|err|\w+Error|\w+Err)\??\.message\b/;

function rawMessageLines(source) {
  return source
    .split(/\r?\n/)
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(
      ({ line }) =>
        RAW.test(line) &&
        !line.includes("friendlyAuthError(") &&
        !/\.message\.includes\(/.test(line) &&
        !line.includes("console.error("),
    );
}

// Self-test: the scanner must catch the pattern it exists for.
eq(
  "scanner flags a raw return",
  rawMessageLines("  if (error) return { ok: false, error: error.message };").length,
  1,
);
eq(
  "scanner flags a raw template",
  rawMessageLines("    return { ok: false, error: `${table}: ${error.message}` };").length,
  1,
);
eq(
  "scanner flags a raw fallback chain",
  rawMessageLines('    return { ok: false, error: entryErr?.message ?? "Entry not found." };').length,
  1,
);
eq(
  "scanner ignores the mapped form",
  rawMessageLines('  if (error) return { ok: false, error: friendlyDbError(error, "Couldn\'t save.") };').length,
  0,
);

function actionFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...actionFiles(full));
    else if (/actions\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

const root = process.cwd();
const files = actionFiles(path.join(root, "src/app"));
ok("found server action files", files.length > 10);
const offenders = [];
for (const file of files) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  for (const { line, n } of rawMessageLines(fs.readFileSync(file, "utf8"))) {
    const allowed = ALLOWED.some((a) => a.file === rel && line.includes(a.snippet));
    if (!allowed) offenders.push(`${rel}:${n}: ${line.trim()}`);
  }
}
if (offenders.length > 0) {
  failed++;
  realConsoleError(
    `  FAIL: server actions return raw error text — use friendlyDbError:\n    ${offenders.join("\n    ")}`,
  );
} else {
  passed++;
}

console.error = realConsoleError;
console.log(`db-errors: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
