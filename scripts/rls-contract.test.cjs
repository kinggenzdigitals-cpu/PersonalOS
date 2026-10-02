"use strict";
/**
 * Row Level Security contract, derived from the migrations themselves.
 *
 * The migrations are replayed in filename order, tracking every public table,
 * whether RLS is on, and which policies are still live after later files drop
 * and recreate them. Then:
 *
 *  1. every table has RLS enabled;
 *  2. every RLS table keeps at least one PERMISSIVE policy — unless it is
 *     service-role-only on purpose (SERVICE_ROLE_ONLY below);
 *  3. every owner policy (`*_owner_*`) still compares auth.uid() to user_id,
 *     in its USING clause when it has one (that clause decides which rows are
 *     visible), with no top-level OR there that could widen it.
 *
 * The previous version checked a hand-kept list of 9 tables, so deleting RLS
 * from subscriptions or dropping every promo_codes policy still passed.
 *
 * Limit: policies created with dynamic SQL (`execute format(...)`, as 0027
 * does) are invisible here. That's acceptable for RESTRICTIVE policies, which
 * only ever narrow access and never count toward rule 2.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const DIR = path.join(process.cwd(), "supabase/migrations");

/**
 * Tables with RLS on and intentionally NO policy: only the service role, which
 * bypasses RLS, may read or write them. Adding a table here is a security
 * decision — say why.
 */
const SERVICE_ROLE_ONLY = [
  "billing_events", // 0016: payment ledger, read and written only by the PayMongo webhook
  "promo_redeem_attempts", // 0029: promo guessing throttle; a user must not read or clear their own
];

const stripComments = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

const NAME = String.raw`((?:[a-z_0-9]+\.)?[a-z_0-9]+)`;
const POLICY = String.raw`("[^"]+"|[a-z_0-9]+)`;
// Group numbers: 1 create table, 2 drop table, 3-4 rls table + mode,
// 5-7 create policy name, table, rest of statement, 8-9 drop policy name, table.
const STATEMENT = new RegExp(
  [
    String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?${NAME}`,
    String.raw`drop\s+table\s+(?:if\s+exists\s+)?${NAME}`,
    String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${NAME}\s+(enable|disable)\s+row\s+level\s+security`,
    String.raw`create\s+policy\s+${POLICY}\s+on\s+${NAME}([^;]*)`,
    String.raw`drop\s+policy\s+(?:if\s+exists\s+)?${POLICY}\s+on\s+${NAME}`,
  ].join("|"),
  "g",
);

/** "public.foo" and "foo" → "foo"; any other schema → null (not ours to police). */
function publicName(qualified) {
  const [schema, name] = qualified.includes(".") ? qualified.split(".") : ["public", qualified];
  return schema === "public" ? name : null;
}
const unquote = (name) => name.replace(/^"|"$/g, "");

/** Replays the files in order → Map<table, { file, rls, policies: Map<name, statement> }>. */
function replay(files) {
  const tables = new Map();
  for (const { file, sql } of files) {
    for (const m of stripComments(sql).toLowerCase().matchAll(STATEMENT)) {
      if (m[1]) {
        const table = publicName(m[1]);
        if (table && !tables.has(table)) tables.set(table, { file, rls: false, policies: new Map() });
      } else if (m[2]) {
        const table = publicName(m[2]);
        if (table) tables.delete(table);
      } else if (m[3]) {
        const entry = tables.get(publicName(m[3]));
        if (entry) entry.rls = m[4] === "enable";
      } else if (m[5]) {
        tables.get(publicName(m[6]))?.policies.set(unquote(m[5]), m[7]);
      } else if (m[8]) {
        tables.get(publicName(m[9]))?.policies.delete(unquote(m[8]));
      }
    }
  }
  return tables;
}

// auth.uid() = user_id, either way round, with or without the (select ...) wrapper.
const OWNER_CHECK =
  /(?:\(\s*select\s+)?auth\.uid\(\)\s*\)?\s*=\s*user_id\b|\buser_id\s*=\s*\(?\s*(?:select\s+)?auth\.uid\(\)/;

/** Index of the ")" closing the "(" at `open`, or -1 if it never closes. */
function closingParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

/** The body of `using (...)` without redundant outer parentheses; null if there is none. */
function usingExpression(statement) {
  const at = statement.search(/\busing\s*\(/);
  if (at === -1) return null;
  let expr = statement.slice(statement.indexOf("(", at));
  expr = expr.slice(0, closingParen(expr, 0) + 1);
  while (expr.startsWith("(") && closingParen(expr, 0) === expr.length - 1) expr = expr.slice(1, -1).trim();
  return expr;
}

/** `expr` with every parenthesised group blanked out, leaving only its top level. */
function topLevel(expr) {
  while (/\([^()]*\)/.test(expr)) expr = expr.replace(/\([^()]*\)/g, " ");
  return expr;
}

/** Returns human-readable problems; empty means the contract holds. */
function problems(files, serviceRoleOnly) {
  const tables = replay(files);
  const out = [];
  for (const [table, { file, rls, policies }] of tables) {
    if (!rls) {
      out.push(`${table} (created in ${file}) must "enable row level security"`);
      continue;
    }
    const permissive = [...policies.keys()].filter(
      (name) => !/\bas\s+restrictive\b/.test(policies.get(name)),
    );
    if (serviceRoleOnly.includes(table)) {
      if (permissive.length > 0) {
        out.push(`${table} is in SERVICE_ROLE_ONLY but has policies (${permissive.join(", ")}); remove it from the list`);
      }
    } else if (permissive.length === 0) {
      out.push(
        `${table} has RLS on but no policy survives the last migration, so only the service role can reach it. ` +
          "Recreate its policy, or add it to SERVICE_ROLE_ONLY with a reason",
      );
    }
    for (const [name, statement] of policies) {
      if (!name.includes("_owner_")) continue;
      // A WITH CHECK comparison doesn't stop `using (true)` exposing every row.
      const using = usingExpression(statement);
      if (!OWNER_CHECK.test(using ?? statement)) {
        out.push(`${table}: owner policy "${name}" must compare auth.uid() to user_id${using === null ? "" : " in USING"}`);
      } else if (using !== null && /\bor\b/.test(topLevel(using))) {
        out.push(`${table}: owner policy "${name}" has a top-level OR in USING, which widens it past the owner`);
      }
    }
  }
  for (const table of serviceRoleOnly) {
    if (!tables.has(table)) out.push(`SERVICE_ROLE_ONLY lists ${table}, which no migration creates`);
  }
  return out;
}

// --- The checker must actually catch what it claims to (self-test) ----------
const run = (sql, serviceRoleOnly = []) => problems([{ file: "t.sql", sql }], serviceRoleOnly);
const T = "create table if not exists public.t (id uuid, user_id uuid);\n";
const RLS = "alter table public.t enable row level security;\n";
const OWNER = 'create policy "t_owner_all" on public.t for all to authenticated using (auth.uid() = user_id);\n';

assert.deepEqual(run(T + RLS + OWNER), [], "self-test: an owner table with RLS and a policy passes");
assert.equal(run(T + OWNER).length, 1, "self-test: a table without RLS is flagged");
assert.equal(run(T + RLS + OWNER + "alter table public.t disable row level security;").length, 1, "self-test: disabling RLS later is flagged");
assert.equal(run(T + RLS + OWNER + 'drop policy if exists "t_owner_all" on public.t;').length, 1, "self-test: dropping the last policy is flagged");
assert.equal(
  run(T + RLS + 'create policy "t_active" on public.t as restrictive for all to authenticated using (true);').length,
  1,
  "self-test: a restrictive policy alone does not count",
);
assert.deepEqual(run(T + RLS, ["t"]), [], "self-test: an allow-listed service-role table passes with no policy");
assert.equal(run(T + RLS + OWNER, ["t"]).length, 1, "self-test: an allow-listed table that gains a policy is flagged");
assert.equal(
  run(T + RLS + 'create policy "t_owner_all" on public.t for all to authenticated using (true);').length,
  1,
  "self-test: an owner policy that doesn't check auth.uid() is flagged",
);
assert.equal(
  run(T + RLS + 'create policy "t_owner_all" on public.t for all to authenticated using (true) with check (auth.uid() = user_id);').length,
  1,
  "self-test: an open USING is flagged even when WITH CHECK compares auth.uid()",
);
assert.equal(
  run(T + RLS + 'create policy "t_owner_all" on public.t for all using (((auth.uid() = user_id) or true));').length,
  1,
  "self-test: a top-level OR in USING is flagged, through redundant parentheses",
);
assert.deepEqual(
  run(T + RLS + 'create policy "t_owner_read" on public.t for select using (auth.uid() = user_id and (id is null or id is not null));'),
  [],
  "self-test: an OR nested inside an AND passes",
);
assert.deepEqual(
  run(T + RLS + 'create policy "t_owner_insert" on public.t for insert with check (auth.uid() = user_id);'),
  [],
  "self-test: an insert-only owner policy is checked on WITH CHECK",
);
assert.deepEqual(
  run(T + RLS + 'create policy "t_owner_all" on public.t for all using ((select auth.uid()) = user_id);'),
  [],
  "self-test: the (select auth.uid()) form passes",
);
assert.deepEqual(run(T + RLS + OWNER + '-- drop policy if exists "t_owner_all" on public.t;\n'), [], "self-test: commented-out statements are ignored");
assert.deepEqual(run("create table if not exists auth.x (id int);"), [], "self-test: other schemas are ignored");

// --- The real migrations -----------------------------------------------------
const files = fs
  .readdirSync(DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => ({ file, sql: fs.readFileSync(path.join(DIR, file), "utf8") }));
const tables = replay(files);
assert.ok(tables.size >= 30, `expected the migrations to create 30+ tables, found ${tables.size}; is the parser still matching?`);

const failures = problems(files, SERVICE_ROLE_ONLY);
assert.deepEqual(failures, [], `RLS contract:\n  ${failures.join("\n  ")}`);
console.log(`RLS contract checks passed (${tables.size} tables, ${SERVICE_ROLE_ONLY.length} service-role-only)`);
