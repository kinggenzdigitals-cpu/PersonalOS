"use strict";
/**
 * Legal page dates. Compiled to .tmp-test, then run on bare node — no
 * dependencies. The label helper is tested directly; the wiring (the sitemap
 * and both pages read the same constants, never a build timestamp) is checked
 * against the source text, because sitemap.ts once stamped /privacy with every
 * deploy's date while the page itself said "July 2026".
 */
const fs = require("node:fs");
const path = require("node:path");
const {
  PRIVACY_UPDATED,
  TERMS_UPDATED,
  legalDateLabel,
} = require("../.tmp-test/legal-dates.js");

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
function throws(label, fn) {
  try {
    fn();
  } catch {
    passed++;
    return;
  }
  failed++;
  console.error(`  FAIL: ${label}\n    expected a throw`);
}

const root = process.cwd();
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (rel) => stripComments(fs.readFileSync(path.join(root, rel), "utf8"));

// --- Label ------------------------------------------------------------------
eq("mid-month", legalDateLabel("2026-09-15"), "September 2026");
// The case Date + a negative UTC offset would print as "December 2025".
eq("first of the month", legalDateLabel("2026-01-01"), "January 2026");
eq("last of the year", legalDateLabel("2026-12-31"), "December 2026");
throws("month 13", () => legalDateLabel("2026-13-01"));
throws("month 00", () => legalDateLabel("2026-00-10"));
throws("already a label", () => legalDateLabel("July 2026"));
throws("unpadded", () => legalDateLabel("2026-9-15"));
throws("empty", () => legalDateLabel(""));

// --- The constants are real, published dates -----------------------------------
for (const [name, iso] of [
  ["PRIVACY_UPDATED", PRIVACY_UPDATED],
  ["TERMS_UPDATED", TERMS_UPDATED],
]) {
  eq(`${name} is an ISO date`, /^\d{4}-\d{2}-\d{2}$/.test(iso), true);
  eq(`${name} has a label`, typeof legalDateLabel(iso), "string");
  eq(
    `${name} is not in the future`,
    Date.parse(`${iso}T00:00:00Z`) <= Date.now() + 24 * 60 * 60 * 1000,
    true,
  );
}

// --- Sitemap and pages read the same constants ----------------------------------
const sitemap = read("src/app/sitemap.ts");
eq("sitemap has no build-time timestamp", /new Date\(/.test(sitemap), false);
eq("sitemap dates /privacy", sitemap.includes("lastModified: PRIVACY_UPDATED"), true);
eq("sitemap dates /terms", sitemap.includes("lastModified: TERMS_UPDATED"), true);

const privacy = read("src/app/privacy/page.tsx");
const terms = read("src/app/terms/page.tsx");
eq("privacy label comes from the constant", privacy.includes("legalDateLabel(PRIVACY_UPDATED)"), true);
eq("terms label comes from the constant", terms.includes("legalDateLabel(TERMS_UPDATED)"), true);
eq("privacy has no hard-coded date", /updated="/.test(privacy), false);
eq("terms has no hard-coded date", /updated="/.test(terms), false);

console.log(`legal-dates: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
