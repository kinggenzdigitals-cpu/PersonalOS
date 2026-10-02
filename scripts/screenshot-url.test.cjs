"use strict";
/**
 * Tests for the feedback screenshot-link check. Compiled to .tmp-test with
 * tsc src/lib/screenshot-url.ts, then run on bare node — no dependencies.
 */
const { normalizeScreenshotUrl, SCREENSHOT_URL_MAX } = require("../.tmp-test/screenshot-url.js");

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
const ok = (url) => ({ ok: true, url });
const rejected = (raw) => eq(`rejects ${JSON.stringify(raw).slice(0, 60)}`, normalizeScreenshotUrl(raw).ok, false);

// --- Empty means "no link" --------------------------------------------------
eq("undefined", normalizeScreenshotUrl(undefined), ok(null));
eq("null", normalizeScreenshotUrl(null), ok(null));
eq("empty", normalizeScreenshotUrl(""), ok(null));
eq("whitespace only", normalizeScreenshotUrl("   \t"), ok(null));

// --- https is accepted, in its parsed form ----------------------------------
eq("plain https", normalizeScreenshotUrl("https://x.test/a.png"), ok("https://x.test/a.png"));
eq("surrounding whitespace trimmed", normalizeScreenshotUrl("  https://x.test/a.png \n"), ok("https://x.test/a.png"));
eq("scheme and host lowercased", normalizeScreenshotUrl("HTTPS://X.TEST/A.png"), ok("https://x.test/A.png"));
eq("space in path is percent-encoded", normalizeScreenshotUrl("https://x.test/a b.png"), ok("https://x.test/a%20b.png"));
eq("query and hash kept", normalizeScreenshotUrl("https://x.test/s?id=1#v"), ok("https://x.test/s?id=1#v"));

// --- Everything else is refused ---------------------------------------------
rejected("javascript:alert(1)");
rejected("JavaScript:alert(1)");
rejected("data:text/html,<script>alert(1)</script>");
rejected("http://x.test/a.png");
rejected("ms-settings:");
rejected("file:///etc/passwd");
rejected("//x.test/a.png");
rejected("x.test/a.png");
rejected("https://");
rejected("https://x .test/a.png");
rejected("https://" + "a".repeat(SCREENSHOT_URL_MAX));
eq("error message", normalizeScreenshotUrl("http://x.test").error, "Screenshot link must be an https:// URL.");

// --- Every accepted value satisfies the 0030 database check ------------------
const DB_CHECK = /^https:\/\/[^\s]+$/i;
for (const raw of ["https://x.test/a b.png", "https://x.test/ x", "https://x.test/#a b", "https://u ser@x.test/"]) {
  const r = normalizeScreenshotUrl(raw);
  eq(`${JSON.stringify(raw)} stored form passes the db check`, r.ok && DB_CHECK.test(r.url) && r.url.length <= SCREENSHOT_URL_MAX, true);
}

console.log(`screenshot-url: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
