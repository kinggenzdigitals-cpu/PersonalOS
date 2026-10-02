"use strict";
/**
 * Feedback write bounds, read from the migrations and the code:
 *
 *  1. screenshot_url is https-only in the database (users can insert through
 *     PostgREST), in submitFeedback(), and the admin console only links https;
 *  2. authenticated may UPDATE only the triage columns, and admin text is
 *     capped at the same 4000 characters as updateFeedback().
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const ROOT = process.cwd();
const DIR = path.join(ROOT, "supabase/migrations");
const stripSql = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const sql = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => stripSql(fs.readFileSync(path.join(DIR, f), "utf8")).toLowerCase())
  .join("\n");

// 1. screenshot_url
assert.match(
  sql,
  /add\s+constraint\s+feedback_screenshot_url_https\s+check\s*\(\s*screenshot_url\s+is\s+null\s+or\s*\(\s*screenshot_url\s+~\*\s+'\^https:\/\/\[\^\[:space:\]\]\+\$'\s+and\s+char_length\(screenshot_url\)\s*<=\s*2048\s*\)\s*\)/,
  "feedback.screenshot_url needs the https-only check constraint",
);
const cleanupAt = sql.search(/update\s+public\.feedback\s+set\s+screenshot_url\s*=\s*null/);
const checkAt = sql.indexOf("add constraint feedback_screenshot_url_https");
assert.ok(cleanupAt > 0 && cleanupAt < checkAt, "existing non-https links must be cleared before the constraint is added");

const action = read("src/app/(app)/feedback/actions.ts");
assert.match(action, /normalizeScreenshotUrl\(input\.screenshotUrl\)/, "submitFeedback must validate the screenshot link");
assert.match(action, /screenshot_url:\s*screenshot\.url/, "submitFeedback must store the normalised link");

const dashboard = read("src/components/admin/admin-dashboard.tsx");
const link = dashboard.slice(dashboard.indexOf("{f.screenshot_url &&"), dashboard.indexOf("View screenshot"));
assert.match(link, /\/\^https:\\\/\\\/\/i\.test\(f\.screenshot_url\)\s*\?\s*<a href=\{f\.screenshot_url\}/, "only an https screenshot_url may render as a link");

// 2. Column-bounded admin update
const revokeAt = sql.search(/revoke\s+update\s+on\s+public\.feedback\s+from\s+anon,\s*authenticated/);
const grant = sql.match(/grant\s+update\s*\(([^)]*)\)\s*on\s+public\.feedback\s+to\s+authenticated/);
assert.ok(revokeAt > 0, "table-wide UPDATE on feedback must be revoked from anon and authenticated");
assert.ok(grant && sql.indexOf(grant[0]) > revokeAt, "the column grant must follow the revoke");
assert.deepEqual(
  grant[1].split(",").map((c) => c.trim()).sort(),
  ["admin_note", "admin_response", "archived", "is_duplicate", "status"],
  "authenticated may update only the triage columns updateFeedback() writes",
);
assert.match(
  sql,
  /add\s+constraint\s+feedback_admin_text_len_check\s+check\s*\(\s*coalesce\(char_length\(admin_note\),\s*0\)\s*<=\s*4000\s+and\s+coalesce\(char_length\(admin_response\),\s*0\)\s*<=\s*4000\s*\)/,
  "admin_note / admin_response need the 4000-character cap in the database",
);
const actions = read("src/app/(app)/admin/actions.ts");
assert.match(actions, /const MAX = 4000;/, "the database cap must match updateFeedback()'s MAX");

console.log("feedback contract checks passed");
