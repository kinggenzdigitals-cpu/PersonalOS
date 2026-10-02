"use strict";
/**
 * Account data-rights contract, read from the migrations and the settings
 * actions themselves:
 *
 *  1. "Download my data" exports every table a user owns rows in;
 *  2. "Delete all data" clears every one of them, except those kept on purpose;
 *  3. the export never includes a device's token hash;
 *  4. the admin audit trail outlives the admin who wrote it;
 *  5. self-service account deletion refuses a super admin before deleting;
 *  6. no `.ilike()` in src takes a raw value, only an `ilikeExact(...)` pattern;
 *  7. the export and the reset filter every query to the caller's user_id,
 *     since RLS lets a super admin read every user's feedback and promos.
 *
 * Both lists in settings/actions.ts were hand-kept, and 0025/0026 tables went
 * missing from them without anything failing.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const ROOT = process.cwd();
const DIR = path.join(ROOT, "supabase/migrations");
const ACTIONS = path.join(ROOT, "src/app/(app)/settings/actions.ts");

/** Owned, but deliberately NOT exported. Say why. */
const NOT_EXPORTED = {
  billing_events: "service-role-only payment ledger (0016); RLS gives the user no read",
  promo_redeem_attempts: "service-role-only guessing throttle (0029); RLS gives the user no read",
};
/** Owned, but deliberately kept by "Delete all data". Say why. */
const KEPT_BY_RESET = {
  profiles: "the login and its settings stay; onboarded is reset instead",
  categories: "kept so the reset account still has categories",
  subscriptions: "paid access outlives a data reset",
  promotion_offers: "an offer made to the account, not user content",
  billing_events: "payment record, service-role only",
  account_devices: "the login stays, so do its devices",
  promo_redemptions: "a purchase record, with no owner DELETE policy",
  promo_redeem_attempts: "guessing throttle, service role only; a data reset must not clear it",
};

const stripSql = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

const sql = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => stripSql(fs.readFileSync(path.join(DIR, f), "utf8")).toLowerCase())
  .join("\n");

// --- Every public table with a user_id pointing at auth.users -----------------
const owned = new Set();
for (const m of sql.matchAll(
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s*\(([\s\S]*?)\n\);/g,
)) {
  if (/^\s*user_id\s+uuid\b[^,\n]*references\s+auth\.users/m.test(m[2])) owned.add(m[1]);
}
assert.ok(owned.size >= 25, `expected 25+ user-owned tables, found ${owned.size}; is the parser still matching?`);

// --- The two lists in settings/actions.ts (full-line comments removed) ---------
const ts = fs.readFileSync(ACTIONS, "utf8").replace(/^\s*\/\/.*$/gm, "");
const names = (block) => [...block.matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1]);
const exportBlock = ts.match(/const OWNED_TABLES = \[([\s\S]*?)\] as const/);
const resetBlock = ts.match(/export async function deleteAllData[\s\S]*?const tables = \[([\s\S]*?)\] as const/);
assert.ok(exportBlock, "couldn't find OWNED_TABLES in settings/actions.ts");
assert.ok(resetBlock, "couldn't find the deleteAllData table list in settings/actions.ts");
const exported = names(exportBlock[1]);
const reset = names(resetBlock[1]);

// 1. + 2. Coverage
assert.deepEqual(
  [...owned].filter((t) => !exported.includes(t) && !(t in NOT_EXPORTED)),
  [],
  "user-owned tables missing from the OWNED_TABLES export (add them, or to NOT_EXPORTED with a reason)",
);
assert.deepEqual(
  [...owned].filter((t) => !reset.includes(t) && !(t in KEPT_BY_RESET)),
  [],
  "user-owned tables that survive deleteAllData (add them, or to KEPT_BY_RESET with a reason)",
);
// No stale entries either way.
for (const t of [...exported, ...reset, ...Object.keys(NOT_EXPORTED), ...Object.keys(KEPT_BY_RESET)]) {
  assert.ok(owned.has(t), `${t} is listed, but no migration creates it with a user_id`);
}
for (const t of Object.keys(KEPT_BY_RESET)) {
  assert.ok(!reset.includes(t), `${t} is in KEPT_BY_RESET but deleteAllData deletes it`);
}

// 3. The device credential stays out of the export
const deviceColumns = ts.match(/account_devices:\s*"([^"]*)"/);
assert.ok(deviceColumns, "account_devices needs an EXPORT_COLUMNS entry, or select(*) exports device_token_hash");
assert.ok(!deviceColumns[1].includes("device_token_hash"), "the export must not include device_token_hash");

// 4. The audit trail survives its actor: the LAST definition of the admin_id FK wins
const fkDefs = [
  ...sql.matchAll(
    /admin_id\s+uuid[^,\n]*references\s+auth\.users\s*\(id\)\s*on\s+delete\s+(cascade|set\s+null)|foreign\s+key\s*\(admin_id\)\s*references\s+auth\.users\s*\(id\)\s*on\s+delete\s+(cascade|set\s+null)/g,
  ),
];
assert.ok(fkDefs.length > 0, "couldn't find the admin_audit_log.admin_id foreign key");
const lastFk = fkDefs[fkDefs.length - 1];
assert.equal(
  (lastFk[1] ?? lastFk[2]).replace(/\s+/g, " "),
  "set null",
  "admin_audit_log.admin_id must be on delete set null, or deleting an admin erases their audit rows",
);
assert.match(sql, /alter\s+column\s+admin_id\s+drop\s+not\s+null/, "admin_id must be nullable for on delete set null");

// 5. deleteAccount refuses a super admin before it deletes anything
const deleteAccount = ts.slice(ts.indexOf("export async function deleteAccount"));
const roleAt = deleteAccount.indexOf('role === "super_admin"');
const deleteAt = deleteAccount.indexOf("auth.admin.deleteUser");
assert.ok(deleteAt > 0, "couldn't find auth.admin.deleteUser in deleteAccount");
assert.ok(roleAt > 0 && roleAt < deleteAt, "deleteAccount must refuse a super_admin before auth.admin.deleteUser");

// 6. No raw ILIKE patterns anywhere in src
function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
const rawIlike = [];
for (const file of sources(path.join(ROOT, "src"))) {
  for (const m of fs.readFileSync(file, "utf8").matchAll(/\.ilike\(\s*("[^"]*"|'[^']*'|`[^`]*`)\s*,\s*([^)]*)/g)) {
    if (!m[2].trim().startsWith("ilikeExact(")) {
      rawIlike.push(`${path.relative(ROOT, file)}: .ilike(${m[1]}, ${m[2].trim()})`);
    }
  }
}
assert.deepEqual(rawIlike, [], "wrap .ilike() values in ilikeExact() — raw `_`, `%`, `*` are wildcards");

// 7. Scoped to the caller, not left to RLS
const CALLER = /\.eq\(\s*"user_id"\s*,\s*user\.id\s*\)/;
const exportFn = ts.slice(
  ts.indexOf("export async function exportAllData"),
  ts.indexOf("export async function deleteAllData"),
);
const pageBuilder = exportFn.match(/fetchAllPages\(([\s\S]*?)\.range\(/);
assert.ok(pageBuilder, "couldn't find the fetchAllPages page builder in exportAllData");
assert.match(pageBuilder[1], CALLER, 'exportAllData must filter every read with .eq("user_id", user.id)');
const resetFn = ts.slice(
  ts.indexOf("export async function deleteAllData"),
  ts.indexOf("export async function deleteAccount"),
);
assert.match(
  resetFn,
  new RegExp(String.raw`\.delete\(\)\s*` + CALLER.source),
  'deleteAllData must filter every delete with .eq("user_id", user.id)',
);

console.log(
  `account data contract checks passed (${owned.size} user-owned tables, ${exported.length} exported, ${reset.length} reset)`,
);
