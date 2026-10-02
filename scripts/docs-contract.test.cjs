"use strict";
/**
 * The runbooks must match the repo. DEPLOY.md once listed 5 of 25 migrations
 * and 3 of the 6 required env vars, so a rebuild that followed it came up with
 * no billing tables and no billing secrets.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const deploy = read("DEPLOY.md");
const readme = read("README.md");
const environment = read("docs/ENVIRONMENT.md");
const checklist = read("docs/LAUNCH_CHECKLIST.md");

// --- Migrations --------------------------------------------------------------
const migrations = fs
  .readdirSync(path.join(root, "supabase/migrations"))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();
assert.ok(migrations.length > 0, "expected migrations in supabase/migrations");
const unlisted = migrations.filter((f) => !deploy.includes(f));
assert.deepEqual(unlisted, [], `DEPLOY.md step 2 must list every migration. Add:\n  ${unlisted.join("\n  ")}`);
assert.match(deploy, /migrations-contract/, "DEPLOY.md must point to the migrations contract (which files are safe to re-run)");

// Other docs defer to DEPLOY.md instead of keeping a second list that goes stale.
assert.match(readme, /DEPLOY\.md/, "README.md setup must point to DEPLOY.md for the migration list");
const pinned = checklist.match(/\b\d{4}_[a-z0-9_]+\.sql\b/g) || [];
assert.deepEqual(pinned, [], "docs/LAUNCH_CHECKLIST.md must point to DEPLOY.md, not name migration files");

// --- Environment variables ---------------------------------------------------
const preflight = read("scripts/launch-preflight.cjs").match(/const required = \[([\s\S]*?)\];/);
assert.ok(preflight, "scripts/launch-preflight.cjs must define a `required` array");
const required = [...preflight[1].matchAll(/"([A-Z0-9_]+)"/g)].map((m) => m[1]);
assert.ok(required.length >= 6, "expected at least 6 required production variables");
for (const key of required) {
  assert.ok(deploy.includes(key), `DEPLOY.md must tell the operator to set ${key}`);
  assert.ok(environment.includes(key), `docs/ENVIRONMENT.md must document ${key}`);
}

// Every variable the app reads is documented (platform-provided ones excepted).
function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}
const readInCode = new Set(
  sourceFiles(path.join(root, "src")).flatMap((file) =>
    [...fs.readFileSync(file, "utf8").matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]),
  ),
);
const PLATFORM = /^(NODE_ENV|NEXT_RUNTIME|VERCEL(_[A-Z0-9_]+)?)$/;
const undocumented = [...readInCode].filter((key) => !PLATFORM.test(key) && !environment.includes(key)).sort();
assert.deepEqual(undocumented, [], `docs/ENVIRONMENT.md must document every variable the app reads: ${undocumented.join(", ")}`);

// --- Billing provider --------------------------------------------------------
for (const [name, text] of [
  ["DEPLOY.md", deploy],
  ["README.md", readme],
  ["docs/ENVIRONMENT.md", environment],
]) {
  assert.ok(!/xendit/i.test(text), `${name} still mentions Xendit; billing is PayMongo`);
}
assert.match(deploy, /\/api\/webhooks\/paymongo/, "DEPLOY.md must register the PayMongo webhook");
assert.match(deploy, /npm run launch:preflight/, "DEPLOY.md must run the launch preflight");

console.log(`docs contract checks passed (${migrations.length} migrations, ${required.length} required env vars)`);
