"use strict";
/**
 * Tests for the protected-area redirect ladder. Compiled to .tmp-test first:
 *   tsc src/lib/auth-gate.ts --outDir .tmp-test --module commonjs --target es2020 --skipLibCheck
 * then run on bare node — no dependencies.
 */
const fs = require("node:fs");
const path = require("node:path");
const { gateRedirect } = require("../.tmp-test/auth-gate.js");

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

const ok = { status: "active", must_change_password: false, onboarded: true };
const p = (over) => ({ ...ok, ...over });

// --- Each step on its own ------------------------------------------------------
eq("signed out", gateRedirect(false, null), "/login");
eq("signed in, no profile row", gateRedirect(true, null), "/onboarding");
eq("signed in, profile undefined", gateRedirect(true, undefined), "/onboarding");
eq("suspended", gateRedirect(true, p({ status: "suspended" })), "/suspended");
eq("revoked", gateRedirect(true, p({ status: "revoked" })), "/suspended");
eq("unknown status fails closed", gateRedirect(true, p({ status: "frozen" })), "/suspended");
eq("temporary password", gateRedirect(true, p({ must_change_password: true })), "/change-password");
eq("not onboarded", gateRedirect(true, p({ onboarded: false })), "/onboarding");
eq("active, onboarded account renders", gateRedirect(true, ok), null);
// A missing status reads as the column default, as it does in the database.
eq("null status reads as active", gateRedirect(true, p({ status: null })), null);
eq("missing columns read as defaults", gateRedirect(true, { onboarded: true }), null);

// --- Order: the lockouts come before onboarding ----------------------------------
eq(
  "signed out beats every profile state",
  gateRedirect(false, p({ status: "suspended", must_change_password: true, onboarded: false })),
  "/login",
);
eq("suspended beats a temporary password", gateRedirect(true, p({ status: "suspended", must_change_password: true })), "/suspended");
// The regression the ladder's docstring warns about.
eq("suspended beats onboarding", gateRedirect(true, p({ status: "suspended", onboarded: false })), "/suspended");
eq("revoked beats onboarding", gateRedirect(true, p({ status: "revoked", onboarded: false })), "/suspended");
eq("temporary password beats onboarding", gateRedirect(true, p({ must_change_password: true, onboarded: false })), "/change-password");
eq(
  "suspended beats both at once",
  gateRedirect(true, p({ status: "suspended", must_change_password: true, onboarded: false })),
  "/suspended",
);

// --- Every combination lands on its FIRST failing step ---------------------------
// The spec, written out independently of the module under test.
function expected(signedIn, profile) {
  if (!signedIn) return "/login";
  if (!profile) return "/onboarding";
  if (profile.status && profile.status !== "active") return "/suspended";
  if (profile.must_change_password) return "/change-password";
  if (!profile.onboarded) return "/onboarding";
  return null;
}
const profiles = [null];
for (const status of [null, "active", "suspended", "revoked"]) {
  for (const must_change_password of [false, true]) {
    for (const onboarded of [false, true]) {
      profiles.push({ status, must_change_password, onboarded });
    }
  }
}
for (const signedIn of [false, true]) {
  for (const profile of profiles) {
    eq(
      `ladder: signedIn=${signedIn} profile=${JSON.stringify(profile)}`,
      gateRedirect(signedIn, profile),
      expected(signedIn, profile),
    );
  }
}

// --- lib/auth.ts routes the page gate through gateRedirect() ---------------------
// A tested ladder is only worth something if the real gate uses it rather than
// growing an inline copy again.
const authSrc = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "auth.ts"), "utf8");
eq("auth.ts imports gateRedirect", /from\s+["']@\/lib\/auth-gate["']/.test(authSrc), true);
eq("auth.ts calls gateRedirect", /gateRedirect\(/.test(authSrc), true);
for (const target of ["/suspended", "/change-password", "/onboarding"]) {
  eq(
    `auth.ts has no inline redirect("${target}")`,
    authSrc.includes(`redirect("${target}")`),
    false,
  );
}

console.log(`auth-gate: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
