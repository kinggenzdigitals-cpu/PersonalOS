"use strict";
/**
 * Tests for the account-status rules. Compiled to .tmp-test first:
 *   tsc src/lib/account-status.ts --outDir .tmp-test --module commonjs --target es2020 --skipLibCheck
 * then run on bare node — no dependencies.
 */
const { isAccountLocked, banDurationFor } = require("../.tmp-test/account-status.js");

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

// --- Who is locked out -------------------------------------------------------
eq("active is not locked", isAccountLocked("active"), false);
eq("suspended is locked", isAccountLocked("suspended"), true);
eq("revoked is locked", isAccountLocked("revoked"), true);
// Unknown future statuses fail closed.
eq("unknown status is locked", isAccountLocked("frozen"), true);
// No status (no profile row yet, pre-onboarding) reads as the column default.
eq("null reads as active", isAccountLocked(null), false);
eq("undefined reads as active", isAccountLocked(undefined), false);
eq("empty string reads as active", isAccountLocked(""), false);

// --- Ban that goes with each status --------------------------------------------
eq("reactivating lifts the ban", banDurationFor("active"), "none");
eq("suspending bans", banDurationFor("suspended"), "876000h");
eq("revoking bans", banDurationFor("revoked"), "876000h");

// Every locked status must carry a real ban, and no unlocked one may.
for (const s of ["active", "suspended", "revoked"]) {
  eq(
    `ban agrees with lock for ${s}`,
    banDurationFor(s) !== "none",
    isAccountLocked(s),
  );
}

// The duration must be one GoTrue parses: decimal number + ns/us/µs/ms/s/m/h.
eq(
  "ban duration is a GoTrue duration",
  /^\d+(ns|us|µs|ms|s|m|h)$/.test(banDurationFor("suspended")),
  true,
);

console.log(`account-status: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
