"use strict";
/**
 * Tests for the post-auth redirect validator. Compiled to .tmp-test by the
 * "test:safe-next" script, then run on bare node — no dependencies.
 */
const { safeNextPath } = require("../.tmp-test/safe-next.js");

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

// --- Same-site paths survive ------------------------------------------------
eq("plain path", safeNextPath("/money"), "/money");
eq("nested path", safeNextPath("/money/budgets"), "/money/budgets");
eq("query and hash kept", safeNextPath("/money?tab=bills#due"), "/money?tab=bills#due");
eq("root", safeNextPath("/"), "/");
eq("encoded slashes stay a local path", safeNextPath("/%2F%2Fevil.com"), "/%2F%2Fevil.com");

// --- Missing input falls back -----------------------------------------------
eq("undefined", safeNextPath(undefined), "/home");
eq("null", safeNextPath(null), "/home");
eq("empty string", safeNextPath(""), "/home");
eq("custom fallback", safeNextPath(null, "/subscription"), "/subscription");
eq("non-string", safeNextPath(42), "/home");

// --- Off-site targets are refused -------------------------------------------
eq("absolute https", safeNextPath("https://evil.com"), "/home");
eq("absolute http with path", safeNextPath("http://evil.com/home"), "/home");
eq("protocol-relative", safeNextPath("//evil.com"), "/home");
// The case the old inline check missed: "\" is parsed as "/" for http(s).
eq("backslash becomes protocol-relative", safeNextPath("/\\evil.com"), "/home");
eq("double backslash", safeNextPath("/\\\\evil.com"), "/home");
eq("tab is stripped by URL parsing", safeNextPath("/\t/evil.com"), "/home");
eq("newline is stripped by URL parsing", safeNextPath("/\n/evil.com"), "/home");
eq("leading space is trimmed by URL parsing", safeNextPath(" //evil.com"), "/home");
eq("javascript scheme", safeNextPath("javascript:alert(1)"), "/home");
eq("data scheme", safeNextPath("data:text/html,x"), "/home");
eq("bare host", safeNextPath("evil.com"), "/home");
eq("relative path without slash", safeNextPath("money"), "/home");
eq("oversized input", safeNextPath("/" + "a".repeat(3000)), "/home");

// --- The old check really was bypassable (proves the test is meaningful) -----
const oldCheck = (n) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/home");
eq(
  "old inline check let the backslash form escape to another origin",
  new URL(oldCheck("/\\evil.com"), "https://site.example").origin,
  "https://evil.com",
);

// --- Every output stays on-origin when resolved the way callers resolve it ---
for (const input of [
  "/money",
  "/\\evil.com",
  "//evil.com",
  "/\t/evil.com",
  "https://evil.com",
  "/%2F%2Fevil.com",
]) {
  eq(
    `output for ${JSON.stringify(input)} resolves on-origin`,
    new URL(safeNextPath(input), "https://site.example").origin,
    "https://site.example",
  );
}

console.log(`safe-next: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
