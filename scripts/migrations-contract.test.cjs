"use strict";
/**
 * Every migration from FROM onward must be safe to run twice.
 *
 * Production is brought up to date by pasting migration files into the
 * Supabase SQL editor. A file that aborts on a second run leaves the database
 * stuck half-way: 0025 shipped three bare `create trigger` statements, so
 * re-running it after any partial apply failed at the first trigger that
 * already existed. This test rejects the statements that are NOT idempotent
 * by default, unless they're written in their guarded form.
 *
 * Earlier migrations (0001-0021) predate this rule and are already applied
 * everywhere, so they're out of scope.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const FROM = 22;
const DIR = path.join(process.cwd(), "supabase/migrations");

const stripComments = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

/** Returns a list of human-readable problems; empty means re-runnable. */
function problems(rawSql) {
  const sql = stripComments(rawSql).toLowerCase();
  const out = [];
  const before = (index, needle) => sql.slice(0, index).includes(needle);

  for (const m of sql.matchAll(/create\s+trigger\s+([a-z_0-9]+)/g)) {
    if (!new RegExp(`drop\\s+trigger\\s+if\\s+exists\\s+${m[1]}\\b`).test(sql.slice(0, m.index))) {
      out.push(`create trigger ${m[1]} has no "drop trigger if exists ${m[1]}" before it`);
    }
  }
  for (const m of sql.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?([a-z_0-9]+)/g)) {
    const guard = new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+"${m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+on\\s+(?:public\\.)?${m[2]}\\b`);
    if (!guard.test(sql.slice(0, m.index))) {
      out.push(`create policy "${m[1]}" has no matching "drop policy if exists" before it`);
    }
  }
  for (const m of sql.matchAll(/add\s+constraint\s+([a-z_0-9]+)/g)) {
    if (!before(m.index, `drop constraint if exists ${m[1]}`)) {
      out.push(`add constraint ${m[1]} has no "drop constraint if exists ${m[1]}" before it`);
    }
  }
  for (const m of sql.matchAll(/create\s+table\s+(?!if\s+not\s+exists)([a-z_0-9.]+)/g)) {
    out.push(`create table ${m[1]} is missing "if not exists"`);
  }
  for (const m of sql.matchAll(/create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?!if\s+not\s+exists)([a-z_0-9]+)/g)) {
    out.push(`create index ${m[1]} is missing "if not exists"`);
  }
  for (const m of sql.matchAll(/add\s+column\s+(?!if\s+not\s+exists)([a-z_0-9]+)/g)) {
    out.push(`add column ${m[1]} is missing "if not exists"`);
  }
  for (const m of sql.matchAll(/create\s+function\s+([a-z_0-9.]+)/g)) {
    out.push(`create function ${m[1]} should be "create or replace function"`);
  }
  for (const m of sql.matchAll(/add\s+value\s+(?!if\s+not\s+exists)'([^']+)'/g)) {
    out.push(`alter type ... add value '${m[1]}' is missing "if not exists"`);
  }
  return out;
}

// --- The checker must actually catch what it claims to (self-test) ----------
assert.ok(
  problems("create table if not exists public.t (id int);\ncreate trigger t_set_updated_at before update on public.t for each row execute function public.set_updated_at();").length === 1,
  "self-test: a bare create trigger (the original 0025 bug) must be flagged",
);
assert.deepEqual(
  problems("drop trigger if exists t_set on public.t;\ncreate trigger t_set before update on public.t for each row execute function f();"),
  [],
  "self-test: a guarded trigger must pass",
);
assert.ok(problems('create policy "p" on public.t for select using (true);').length === 1, "self-test: bare policy flagged");
assert.deepEqual(problems('drop policy if exists "p" on public.t;\ncreate policy "p" on public.t for select using (true);'), [], "self-test: guarded policy passes");
assert.ok(problems("create table public.t (id int);").length === 1, "self-test: bare create table flagged");
assert.ok(problems("create unique index ix on public.t (a);").length === 1, "self-test: bare create index flagged");
assert.ok(problems("alter table public.t add column c int;").length === 1, "self-test: bare add column flagged");
assert.ok(problems("-- create trigger x\nselect 1;").length === 0, "self-test: commented-out statements are ignored");

// --- Every migration in scope --------------------------------------------------
const files = fs
  .readdirSync(DIR)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f) && Number(f.slice(0, 4)) >= FROM)
  .sort();
assert.ok(files.length > 0, "expected migrations in scope");

const failures = [];
for (const f of files) {
  for (const p of problems(fs.readFileSync(path.join(DIR, f), "utf8"))) failures.push(`${f}: ${p}`);
}
assert.deepEqual(failures, [], `migrations must be re-runnable:\n  ${failures.join("\n  ")}`);

console.log(`migrations contract checks passed (${files.length} files from ${String(FROM).padStart(4, "0")} on)`);
