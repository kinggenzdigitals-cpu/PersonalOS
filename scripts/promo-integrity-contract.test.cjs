"use strict";
/**
 * Promo code integrity, read from the migrations and the code that writes
 * promo_redemptions:
 *
 *  1. a redemption outlives its account (the LAST user_id FK is set null), so a
 *     deleted user's redemption still counts toward max_redemptions;
 *  2. the cap is enforced in the database, under a lock on the code row, for
 *     inserts and for re-opening a released hold;
 *  3. redeemPromoCode maps that refusal, marks stale holds expired (never
 *     deletes them), and throttles before looking a code up;
 *  4. the webhook turns a payment for a released redemption into a refund
 *     record, not a failure PayMongo retries forever;
 *  5. deleteAccount releases unpaid holds and redacts the reference before the
 *     auth user is deleted.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const ROOT = process.cwd();
const DIR = path.join(ROOT, "supabase/migrations");
const stripSql = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const stripTs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p) => stripTs(fs.readFileSync(path.join(ROOT, p), "utf8"));

const sql = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => stripSql(fs.readFileSync(path.join(DIR, f), "utf8")).toLowerCase())
  .join("\n");

// 1. The last definition of promo_redemptions.user_id's FK wins.
const fkDefs = [
  ...sql.matchAll(
    /create\s+table\s+if\s+not\s+exists\s+public\.promo_redemptions\s*\([\s\S]*?user_id\s+uuid[^,\n]*on\s+delete\s+(cascade|set\s+null)|constraint\s+promo_redemptions_user_id_fkey\s+foreign\s+key\s*\(user_id\)\s*references\s+auth\.users\s*\(id\)\s*on\s+delete\s+(cascade|set\s+null)/g,
  ),
];
assert.ok(fkDefs.length > 0, "couldn't find the promo_redemptions.user_id foreign key");
const lastFk = fkDefs[fkDefs.length - 1];
assert.equal(
  (lastFk[1] ?? lastFk[2]).replace(/\s+/g, " "),
  "set null",
  "promo_redemptions.user_id must be on delete set null, or deleting an account frees a capped slot",
);
assert.match(sql, /alter\s+table\s+public\.promo_redemptions\s+alter\s+column\s+user_id\s+drop\s+not\s+null/);

// 2. The cap trigger: locks the code row, covers inserts and status changes.
const fn = sql.match(/function\s+public\.enforce_promo_redemption_cap\(\)[\s\S]*?\$\$([\s\S]*?)\$\$/);
assert.ok(fn, "enforce_promo_redemption_cap() must exist");
assert.match(fn[1], /from\s+public\.promo_codes[\s\S]*?for\s+(no\s+key\s+)?update/, "the cap must lock the promo_codes row");
assert.match(fn[1], /raise\s+exception\s+'promo_cap_reached'/);
assert.match(
  sql,
  /create\s+trigger\s+promo_redemptions_enforce_cap\s+before\s+insert\s+or\s+update\s+of\s+status\s+on\s+public\.promo_redemptions/,
  "the cap trigger must run before insert AND before a status change (re-opening a released hold)",
);

// 3. redeemPromoCode
const billing = read("src/app/(app)/settings/billing-actions.ts");
const redeem = billing.slice(billing.indexOf("export async function redeemPromoCode"));
assert.match(billing, /promo_cap_reached/, "the database's cap refusal must be mapped to a user message");
assert.match(redeem, /status:\s*"expired"/, "stale pending holds must be marked expired");
assert.match(redeem, /pendingCutoffIso\(/, "stale holds are found by the shared cutoff");
const throttleAt = redeem.indexOf("promoAttemptBlocked(");
const lookupAt = redeem.indexOf('.from("promo_codes")');
assert.ok(throttleAt > 0 && lookupAt > 0 && throttleAt < lookupAt, "attempts must be throttled before the code is looked up");
assert.ok(!/Promo code not found|no longer active|has expired/.test(redeem), "invalid codes must share one message");

// 4. Webhook: a redemption released for good (canceled) is a conflict
//    (NEEDS_REFUND), not a failure PayMongo retries forever; one merely swept
//    to expired is recoverable — the payment takes its cap slot back, under
//    the cap trigger, and exactly one row must move.
const route = read("src/app/api/webhooks/paymongo/route.ts");
const promo = route.slice(route.indexOf("async function activatePromo"));
assert.match(
  promo,
  /redemption\.status\s*!==\s*"pending"\s*&&\s*redemption\.status\s*!==\s*"expired"\s*&&\s*redemption\.status\s*!==\s*"active"\s*\)\s*\{[\s\S]*?return\s*\{\s*conflict:/,
  "a payment for a canceled redemption must return a conflict, and an expired one must stay recoverable",
);
assert.match(
  promo,
  /\.update\(\{\s*status:\s*"active"[\s\S]*?\.in\("status",\s*\["pending",\s*"expired"\]\)\s*\.select\("id"\)/,
  "a paid redemption must be moved to active from pending OR expired, and the changed row counted",
);
assert.match(
  promo,
  /promo_cap_reached[\s\S]{0,160}conflict:/,
  "the cap refusal on taking a released slot back must be a refund, not a retry",
);

// 5. deleteAccount
const actions = read("src/app/(app)/settings/actions.ts");
const del = actions.slice(actions.indexOf("export async function deleteAccount"));
const cancelAt = del.search(/from\("promo_redemptions"\)\s*\.update\(\{\s*status:\s*"canceled"\s*\}\)/);
const redactAt = del.search(/invoice_external_id:\s*row\.invoice_external_id\.replace\(user\.id/);
const deleteAt = del.indexOf("auth.admin.deleteUser");
assert.ok(cancelAt > 0 && cancelAt < deleteAt, "deleteAccount must release unpaid promo holds before deleteUser");
assert.ok(redactAt > 0 && redactAt < deleteAt, "deleteAccount must redact the user id in promo references before deleteUser");

console.log("promo integrity contract checks passed");
