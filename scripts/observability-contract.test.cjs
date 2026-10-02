"use strict";
/**
 * Structural checks for the vendor-free observability baseline:
 *  - src/instrumentation.ts logs each server error with its digest and never
 *    reads request headers (they carry the Supabase session cookies);
 *  - src/app/global-error.tsx exists, so a root-layout crash gets our page;
 *  - /api/health is an uncached, secret-free probe that reports a database
 *    outage as 503. (That it's public is checked in proxy-contract.test.cjs.)
 *
 * Comments are stripped first, so a docstring can't satisfy an assertion.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = process.cwd();
const read = (rel) => {
  assert.ok(fs.existsSync(path.join(root, rel)), `${rel} must exist`);
  return fs.readFileSync(path.join(root, rel), "utf8");
};
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

// --- Server error logging ----------------------------------------------------
const instrumentation = stripComments(read("src/instrumentation.ts"));
assert.match(instrumentation, /export\s+(?:const|(?:async\s+)?function)\s+onRequestError\b/, "instrumentation must export onRequestError");
assert.match(instrumentation, /\bdigest\b/, "each error line must carry the digest the user is shown");
assert.ok(!/\bheaders\b/.test(instrumentation), "onRequestError must never read request headers: they carry session cookies");
assert.match(instrumentation, /request\.path\.split\("\?"\)\[0\]/, "the query string (auth codes, invite tokens) must be dropped from the logged path");
assert.ok(!/\bfetch\(/.test(instrumentation), "errors must not be sent to a third party without an owner decision");

// --- Root-layout errors ------------------------------------------------------
const globalError = stripComments(read("src/app/global-error.tsx"));
assert.match(globalError, /^\s*["']use client["']/, "global-error must be a Client Component");
assert.match(globalError, /<html[\s>]/, "global-error replaces the root layout, so it must render its own <html>");
assert.match(globalError, /<body[\s>]/, "global-error replaces the root layout, so it must render its own <body>");

// --- Health probe ------------------------------------------------------------
const health = stripComments(read("src/app/api/health/route.ts"));
assert.match(health, /export\s+async\s+function\s+GET\b/, "the health route must export GET");
assert.match(health, /\b503\b/, "a failed database round-trip must answer 503");
assert.match(health, /"Cache-Control",\s*"no-store"/, "the probe must never be cached: a cached 200 hides an outage");
assert.match(health, /abortSignal\(/, "the database round-trip must time out rather than hang the monitor");
assert.ok(!/\.message\b|process\.env/.test(health), "the probe must not echo error text or environment values");
assert.ok(!/createAdminClient|service_role/i.test(health), "the probe must not use the service-role key");

console.log("observability contract checks passed");
