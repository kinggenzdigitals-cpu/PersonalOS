"use strict";
/**
 * The auth proxy's allow-list and matcher, checked without a browser.
 *
 * tests/e2e/smoke.spec.ts proves "/money sends a signed-out visitor to /login",
 * but Playwright is not part of `npm test` or CI. This catches the same
 * regressions in plain node: putting an app route on PUBLIC_PATHS, or narrowing
 * the matcher so the proxy stops running on app routes. Server pages also call
 * requireOnboardedAccount(), so either mistake removes a layer rather than
 * exposing data outright — which is exactly why nothing else would notice.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

// --- PUBLIC_PATHS ------------------------------------------------------------
const middleware = stripComments(read("src/lib/supabase/middleware.ts"));
const list = middleware.match(/const PUBLIC_PATHS = \[([\s\S]*?)\];/);
assert.ok(list, "src/lib/supabase/middleware.ts must define PUBLIC_PATHS as an array literal");
const PUBLIC_PATHS = [...list[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
assert.ok(PUBLIC_PATHS.length > 0, "PUBLIC_PATHS must not be empty");

// Mirror of isPublicPath(). Its source is pinned so the mirror can't drift.
assert.match(middleware, /if \(pathname === "\/"\) return true;/, 'isPublicPath must treat "/" as public by exact match only');
assert.match(
  middleware,
  /pathname === p \|\| pathname\.startsWith\(`\$\{p\}\/`\)/,
  "isPublicPath must match a public path exactly or as a whole-segment prefix (update this test's mirror if the rule changes)",
);
const isPublicPath = (pathname) =>
  pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** First URL segment of every route under `dir`, with (groups) flattened. */
function topLevelRoutes(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || /^[_@[]/.test(entry.name)) continue;
    if (entry.name.startsWith("(")) out.push(...topLevelRoutes(path.join(dir, entry.name)));
    else out.push(`/${entry.name}`);
  }
  return out;
}

// Read from the filesystem, so a new app page is covered without editing this.
const appRoutes = topLevelRoutes(path.join(root, "src/app/(app)"));
assert.ok(appRoutes.includes("/money") && appRoutes.includes("/home"), "expected /money and /home under src/app/(app)");

// Signed-in pages that live outside the (app) group.
const OTHER_PROTECTED = ["/onboarding", "/change-password", "/suspended"];
for (const route of OTHER_PROTECTED) {
  assert.ok(fs.existsSync(path.join(root, "src/app", route.slice(1))), `${route} no longer exists; update OTHER_PROTECTED`);
}
const PROTECTED = [...appRoutes, ...OTHER_PROTECTED];

for (const route of PROTECTED) {
  assert.ok(!isPublicPath(route), `${route} needs a session, but PUBLIC_PATHS makes it public`);
  assert.ok(!isPublicPath(`${route}/x`), `${route}/* needs a session, but PUBLIC_PATHS makes it public`);
}

// These must stay reachable signed-out: PayMongo and uptime monitors can't sign in.
for (const route of [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/privacy",
  "/terms",
  "/auth/callback",
  "/invite/some-token",
  "/api/webhooks/paymongo",
  "/api/health",
]) {
  assert.ok(isPublicPath(route), `${route} must stay public`);
}

// --- Proxy matcher -----------------------------------------------------------
const proxy = stripComments(read("src/proxy.ts"));
assert.match(proxy, /updateSession\(request\)/, "the proxy must run updateSession on every matched request");
const matcher = proxy.match(/matcher:\s*\[([\s\S]*?)\]/);
assert.ok(matcher, "src/proxy.ts must export a config.matcher array");
const patterns = [...matcher[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`));
assert.ok(patterns.length > 0, "the proxy matcher must list at least one pattern");
assert.ok(
  patterns.every((p) => !/(^|\/):[a-z]/i.test(p)),
  "the matcher now uses :params; teach this test to translate path-to-regexp syntax",
);
// Plain regex groups (no :params) compile to the same thing as ^pattern$.
const matchers = patterns.map((p) => new RegExp(`^${p}$`));
const proxied = (pathname) => matchers.some((re) => re.test(pathname));
assert.ok(
  !proxied("/_next/static/chunks/app.js") && !proxied("/icon-192.png"),
  "sanity: static assets should be excluded (if this fails, the regex translation is wrong, not the proxy)",
);
for (const route of PROTECTED) {
  assert.ok(proxied(route) && proxied(`${route}/x`), `the proxy matcher must cover ${route}`);
}

console.log(`proxy contract checks passed (${PROTECTED.length} protected routes, ${PUBLIC_PATHS.length} public paths)`);
