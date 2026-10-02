"use strict";
/**
 * Structural checks on the money write/read paths whose safeguards can't be
 * exercised without a database: the monthly transaction cap, the paged
 * export and habit board, the ?account= filter, and the goal compare-and-set.
 *
 * Comments are stripped first so a docstring can never satisfy an assertion.
 * The pager itself has behavioural tests in fetch-all-pages.test.cjs.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = process.cwd();
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (rel) => stripComments(fs.readFileSync(path.join(root, rel), "utf8"));

/** The body of `export async function name(` up to the next top-level function. */
function body(code, name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing function ${name}`);
  const next = code.slice(start + 1).search(/\n(export )?(async )?function /);
  return next < 0 ? code.slice(start) : code.slice(start, start + 1 + next);
}

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
}

const actions = read("src/app/(app)/money/actions.ts");

// 1. The cap counts created_at, never the user-chosen occurred_at.
check("cap helper counts created_at", () => {
  const cap = body(actions, "transactionCapError");
  assert.match(cap, /\.gte\("created_at"/);
  assert.doesNotMatch(cap, /occurred_at/);
  assert.match(cap, /checkTransactionCap\(/);
});
check("createTransaction checks the cap before inserting", () => {
  const fn = body(actions, "createTransaction");
  const cap = fn.indexOf("transactionCapError(");
  assert.ok(cap >= 0, "createTransaction must call transactionCapError");
  assert.ok(cap < fn.indexOf(".insert("), "the cap must be checked before the insert");
});
check("restoreTransaction caps the client's copy, not the signed original", () => {
  const fn = body(actions, "restoreTransaction");
  const verify = fn.indexOf("verifyUndoToken(");
  const cap = fn.indexOf("transactionCapError(");
  assert.ok(verify >= 0, "restoreTransaction must verify the undo token");
  assert.ok(cap >= 0, "restoreTransaction must call transactionCapError");
  assert.ok(verify < cap, "the token decides whether the cap applies");
  assert.ok(cap < fn.indexOf(".insert("), "the cap must be checked before the insert");
  assert.match(fn, /signed \?\?/, "a valid token must insert the signed row");
  assert.doesNotMatch(fn, /\bid:\s*t\.id/, "a client-chosen id must not be inserted");
});
check("deleteTransaction signs the row it removed", () => {
  const fn = body(actions, "deleteTransaction");
  assert.match(fn, /signUndoToken\(/, "the undo token must be minted server-side");
  assert.match(fn, /created_at: data\.created_at/, "the original created_at must be signed");
  assert.match(fn, /undo: signUndoToken\(/, "only the token is handed back, never the key");
});
check("usage meter counts the same column the cap enforces", () => {
  const usage = read("src/lib/queries/usage.ts");
  const tx = usage.slice(usage.indexOf('.from("transactions")'));
  assert.match(tx.slice(0, 200), /\.gte\("created_at"/);
});

// 2. The export pages through every row instead of one clamped range.
check("export is paged with a total order", () => {
  const fn = body(actions, "exportTransactionsAction");
  assert.match(fn, /fetchAllPages\(/);
  assert.match(fn, /\.range\(from, to\)/);
  assert.match(fn, /\.order\("id"\)/);
  assert.doesNotMatch(fn, /limit:\s*100000/);
  assert.match(fn, /if \(error\)/, "a failed page must fail the export");
});

// 3. The habit board pages its logs.
check("habit board logs are paged with a total order", () => {
  const fn = body(read("src/lib/queries/habits.ts"), "fetchHabitsAndLogs");
  assert.match(fn, /fetchAllPages\(/);
  assert.match(fn, /\.range\(from, to\)/);
  assert.match(fn, /\.order\("id"\)/);
});

// 4. ?account= must be a uuid before it reaches .or().
check("account filter is uuid-checked before .or()", () => {
  const fn = body(read("src/lib/queries/money.ts"), "getTransactions");
  const guard = fn.indexOf("isUuid(filters.accountId)");
  assert.ok(guard >= 0, "accountId must pass isUuid");
  assert.ok(guard < fn.indexOf("account_id.eq."), "the check must come before the .or()");
});

// 5. Goal contributions are a compare-and-set on the value read.
check("contributeToGoal is a checked compare-and-set", () => {
  const fn = body(read("src/app/(app)/money/goals-actions.ts"), "contributeToGoal");
  assert.match(fn, /\.eq\("saved_amount",\s*goal\.saved_amount\)/);
  assert.match(fn, /\.update\([\s\S]*?\.select\("id"\)/, "the update must return its rows");
  assert.match(fn, /updated\.length > 0/, "zero updated rows must not count as success");
  assert.match(fn, /for \(let attempt/, "a lost race must be retried");
});

console.log(`money-integrity-contract: ${passed} passed, 0 failed`);
