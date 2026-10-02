"use strict";
/**
 * Tests for the exact-match ILIKE helpers. Compiled to .tmp-test first, then
 * run on bare node — no dependencies.
 *
 * `matches` replays what the database does with a pattern: PostgREST turns
 * every `*` into `%`, then Postgres ILIKE treats `%`/`_` as wildcards and `\`
 * as the escape character.
 */
const { ilikeExact, sameText } = require("../.tmp-test/ilike-exact.js");

let passed = 0;
let failed = 0;
function eq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}\n    expected ${e}\n    got      ${a}`);
  }
}

const escapeRe = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function matches(value, pattern) {
  const sql = pattern.replace(/\*/g, "%");
  let re = "";
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "\\" && i + 1 < sql.length) re += escapeRe(sql[++i]);
    else if (c === "%") re += "[\\s\\S]*";
    else if (c === "_") re += "[\\s\\S]";
    else re += escapeRe(c);
  }
  return new RegExp(`^${re}$`, "i").test(value);
}

/** What a caller ends up with: the database filter, then the sameText check. */
const exactRows = (rows, value) =>
  rows.filter((r) => matches(r, ilikeExact(value)) && sameText(r, value));

// --- The bug is real (proves the tests are meaningful) -----------------------
eq("raw `_` matched another invitee", matches("ana.cruz@yahoo.com", "ana_cruz@yahoo.com"), true);
eq("raw `%` matched a whole domain", matches("bob@gmail.com", "%@gmail.com"), true);
eq("raw `*` matched a whole domain", matches("bob@gmail.com", "*@gmail.com"), true);

// --- Escaping --------------------------------------------------------------
eq("plain address unchanged", ilikeExact("ana@example.com"), "ana@example.com");
eq("underscore escaped", ilikeExact("ana_cruz@x.com"), "ana\\_cruz@x.com");
eq("percent escaped", ilikeExact("100%@x.com"), "100\\%@x.com");
eq("backslash escaped", ilikeExact("a\\b"), "a\\\\b");
eq("star becomes one-char wildcard", ilikeExact("a*b"), "a_b");

// --- The database filter no longer reaches other rows ------------------------
eq("escaped `_` skips the dotted address", matches("ana.cruz@yahoo.com", ilikeExact("ana_cruz@yahoo.com")), false);
eq("escaped `_` still finds itself", matches("ana_cruz@yahoo.com", ilikeExact("ana_cruz@yahoo.com")), true);
eq("still case-insensitive", matches("ANA_Cruz@Yahoo.com", ilikeExact("ana_cruz@yahoo.com")), true);
eq("escaped `%` skips the domain", matches("bob@gmail.com", ilikeExact("%@gmail.com")), false);
eq("escaped `%` finds itself", matches("%@gmail.com", ilikeExact("%@gmail.com")), true);
eq("backslash is literal", matches("a\\b", ilikeExact("a\\b")), true);
eq("backslash doesn't escape the next char", matches("ab", ilikeExact("a\\b")), false);

// --- `*` can't be escaped, so sameText narrows the superset --------------------
eq("star pattern over-matches in the database", matches("axb@x.com", ilikeExact("a*b@x.com")), true);
eq(
  "star: only the exact row survives",
  exactRows(["axb@x.com", "a*b@x.com", "A*B@X.COM", "a**b@x.com"], "a*b@x.com"),
  ["a*b@x.com", "A*B@X.COM"],
);
eq(
  "underscore: only the exact row survives",
  exactRows(["ana.cruz@yahoo.com", "ana_cruz@yahoo.com", "anaxcruz@yahoo.com"], "ana_cruz@yahoo.com"),
  ["ana_cruz@yahoo.com"],
);

// --- sameText ----------------------------------------------------------------
eq("sameText ignores case", sameText("Ana@X.com", "ana@x.com"), true);
eq("sameText rejects different text", sameText("ana.cruz@x.com", "ana_cruz@x.com"), false);
eq("sameText rejects null", sameText(null, ""), false);
eq("sameText rejects undefined", sameText(undefined, "a"), false);

console.log(`ilike-exact: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
