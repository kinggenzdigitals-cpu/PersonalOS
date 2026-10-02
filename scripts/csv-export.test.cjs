"use strict";
/**
 * Tests for the transaction CSV export's cell escaping. Compiled to .tmp-test
 * first, then run on bare node — no dependencies.
 */
const { csvEscape } = require("../.tmp-test/csv-export.js");

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

// --- Plain cells pass through untouched ---------------------------------------
eq("plain text", csvEscape("Jollibee"), "Jollibee");
eq("amount", csvEscape("1500.5"), "1500.5");
eq("date", csvEscape("2026-09-16"), "2026-09-16");
eq("empty", csvEscape(""), "");
eq("formula char later in the cell", csvEscape("a=1+1"), "a=1+1");
eq("hyphen inside a word", csvEscape("Wi-Fi bill"), "Wi-Fi bill");

// --- Leading formula characters are neutralised ---------------------------------
eq("equals", csvEscape("=1+1"), "'=1+1");
eq("plus (phone number)", csvEscape("+639171234567"), "'+639171234567");
eq("minus", csvEscape("-5 refund"), "'-5 refund");
eq("at", csvEscape("@SUM(A1)"), "'@SUM(A1)");
eq("leading tab", csvEscape("\tx"), "'\tx");
eq("leading CR is prefixed and quoted", csvEscape("\r=1"), "\"'\r=1\"");
eq(
  "hyperlink payload is prefixed and quoted",
  csvEscape('=HYPERLINK("u","c")'),
  '"\'=HYPERLINK(""u"",""c"")"',
);

// --- Quoting ------------------------------------------------------------------
eq("comma", csvEscape("SM, Makati"), '"SM, Makati"');
eq("quote", csvEscape('The "Best" Cafe'), '"The ""Best"" Cafe"');
eq("newline", csvEscape("line1\nline2"), '"line1\nline2"');
eq("bare CR mid-cell", csvEscape("line1\rline2"), '"line1\rline2"');

// --- The old escaper let a formula through (proves the test is meaningful) -----
const oldEscape = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
eq("old escaper wrote =1+1 as a live formula", oldEscape("=1+1"), "=1+1");

// --- No output ever starts with a formula character -----------------------------
for (const input of ["=cmd", "+1", "-1", "@x", "\tx", "\rx", '=A1,"b"']) {
  const out = csvEscape(input);
  const cell = out.startsWith('"') ? out.slice(1) : out;
  eq(`output for ${JSON.stringify(input)} is inert`, /^[=+\-@\t\r]/.test(cell), false);
}

console.log(`csv-export: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
