"use strict";
/**
 * Tests for plan resolution — what a stored subscriptions row entitles its
 * owner to. Compiled to .tmp-test first:
 *   tsc src/lib/entitlement-core.ts --outDir .tmp-test --module commonjs --target es2020 --skipLibCheck
 * then run on bare node — no dependencies. isAccessLive() itself is covered
 * by checkout-eligibility.test.cjs; this pins the plan each row resolves to.
 */
const fs = require("node:fs");
const path = require("node:path");
const { resolvePlan, effectivePlan } = require("../.tmp-test/entitlement-core.js");
const { isAccessLive } = require("../.tmp-test/checkout-eligibility.js");

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

const NOW = Date.parse("2026-09-15T00:00:00Z");
const FUTURE = "2026-12-01T00:00:00+00:00";
const PAST = "2026-01-01T00:00:00+00:00";
const row = (over) => ({
  plan: "pro",
  status: "active",
  access_type: "paid",
  access_expires_at: null,
  current_period_end: FUTURE,
  ...over,
});

// ============================================================== resolvePlan
eq("no row is free", resolvePlan(null, NOW), "free");
eq("undefined row is free", resolvePlan(undefined, NOW), "free");

// --- lifetime_pro: its tier, whatever the dates say --------------------------------
for (const plan of ["pro", "premium"]) {
  eq(`lifetime ${plan}`, resolvePlan(row({ plan, access_type: "lifetime_pro", current_period_end: null }), NOW), plan);
  eq(
    `lifetime ${plan} with past dates`,
    resolvePlan(row({ plan, access_type: "lifetime_pro", access_expires_at: PAST, current_period_end: PAST }), NOW),
    plan,
  );
}
eq("lifetime on a non-paid plan value is still Pro", resolvePlan(row({ plan: "free", access_type: "lifetime_pro" }), NOW), "pro");
eq("lifetime ignores subscription status", resolvePlan(row({ access_type: "lifetime_pro", status: "canceled" }), NOW), "pro");

// --- complimentary_pro: until access_expires_at, forever when null --------------------
const comp = (over) => row({ access_type: "complimentary_pro", current_period_end: null, ...over });
eq("comp Pro without an end date", resolvePlan(comp({ access_expires_at: null }), NOW), "pro");
eq("comp Premium without an end date", resolvePlan(comp({ plan: "premium", access_expires_at: null }), NOW), "premium");
eq("comp with a future end", resolvePlan(comp({ access_expires_at: FUTURE }), NOW), "pro");
eq("comp with a past end", resolvePlan(comp({ access_expires_at: PAST }), NOW), "free");
eq("comp with an unparseable end", resolvePlan(comp({ access_expires_at: "garbage" }), NOW), "free");
eq("comp ignores a past current_period_end", resolvePlan(comp({ access_expires_at: FUTURE, current_period_end: PAST }), NOW), "pro");

// --- promo: until access_expires_at, which must be real --------------------------------
const promo = (over) => row({ access_type: "promo", ...over });
eq("promo with a future end", resolvePlan(promo({ access_expires_at: FUTURE }), NOW), "pro");
eq("Premium promo with a future end", resolvePlan(promo({ plan: "premium", access_expires_at: FUTURE }), NOW), "premium");
eq("promo with a past end", resolvePlan(promo({ access_expires_at: PAST }), NOW), "free");
eq("promo with no end", resolvePlan(promo({ access_expires_at: null, current_period_end: null }), NOW), "free");
// The admin list used to fall back to current_period_end here and show Pro,
// while getEntitlement gave the user Free.
eq(
  "promo with no access_expires_at but a future period is free",
  resolvePlan(promo({ access_expires_at: null, current_period_end: FUTURE }), NOW),
  "free",
);

// --- paid (and legacy rows with no access_type): a real, future period -------------------
for (const access_type of ["paid", null]) {
  const paid = (over) => row({ access_type, ...over });
  eq(`${access_type} Pro with a future end`, resolvePlan(paid({}), NOW), "pro");
  eq(`${access_type} Premium with a future end`, resolvePlan(paid({ plan: "premium" }), NOW), "premium");
  eq(`${access_type} with a past end`, resolvePlan(paid({ current_period_end: PAST }), NOW), "free");
  // What admin "Remove Pro access" used to leave behind.
  eq(`${access_type} with no end`, resolvePlan(paid({ current_period_end: null }), NOW), "free");
  eq(`${access_type} with an unparseable end`, resolvePlan(paid({ current_period_end: "garbage" }), NOW), "free");
  for (const status of ["canceled", "past_due", "inactive"]) {
    eq(`${access_type} ${status} with a future end`, resolvePlan(paid({ status }), NOW), "free");
  }
  eq(`${access_type} on plan 'free'`, resolvePlan(paid({ plan: "free" }), NOW), "free");
  eq(
    `${access_type} ignores access_expires_at`,
    resolvePlan(paid({ current_period_end: PAST, access_expires_at: FUTURE }), NOW),
    "free",
  );
}
eq("period ending exactly now is over", resolvePlan(row({ current_period_end: new Date(NOW).toISOString() }), NOW), "free");
eq("unknown access_type needs a live paid period", resolvePlan(row({ access_type: "legacy", current_period_end: PAST }), NOW), "free");

// --- Matrix: every access_type x tier x expiry ------------------------------------------
// Grants carry their end in access_expires_at; paid periods in current_period_end.
const EXPIRIES = { none: null, past: PAST, future: FUTURE, garbage: "garbage" };
const EXPECT_LIVE = {
  lifetime_pro: { none: true, past: true, future: true, garbage: true },
  complimentary_pro: { none: true, past: false, future: true, garbage: false },
  promo: { none: false, past: false, future: true, garbage: false },
  paid: { none: false, past: false, future: true, garbage: false },
  null: { none: false, past: false, future: true, garbage: false },
};
for (const access_type of ["lifetime_pro", "complimentary_pro", "promo", "paid", null]) {
  const grant = access_type === "complimentary_pro" || access_type === "promo" || access_type === "lifetime_pro";
  for (const plan of ["pro", "premium"]) {
    for (const [name, iso] of Object.entries(EXPIRIES)) {
      const r = row({
        plan,
        access_type,
        access_expires_at: grant ? iso : null,
        current_period_end: grant ? null : iso,
      });
      const want = EXPECT_LIVE[String(access_type)][name] ? plan : "free";
      eq(`matrix: ${access_type} ${plan} end=${name}`, resolvePlan(r, NOW), want);
      // "What does this user get?" must agree with "may this user buy?".
      eq(`matrix agrees with isAccessLive: ${access_type} ${plan} end=${name}`, resolvePlan(r, NOW) !== "free", isAccessLive(r, NOW));
    }
  }
}

// ============================================================ effectivePlan
const liveLifetime = row({ plan: "premium", access_type: "lifetime_pro" });
for (const status of ["suspended", "revoked", "frozen"]) {
  eq(`${status} with lifetime is free`, effectivePlan("user", status, liveLifetime, NOW), "free");
  eq(`${status} with a live paid period is free`, effectivePlan("user", status, row(), NOW), "free");
  eq(`${status} super admin is free`, effectivePlan("super_admin", status, liveLifetime, NOW), "free");
}
eq("active super admin without a row is premium", effectivePlan("super_admin", "active", undefined, NOW), "premium");
eq("active user without a row is free", effectivePlan("user", "active", undefined, NOW), "free");
eq("active user with live paid Premium", effectivePlan("user", "active", row({ plan: "premium" }), NOW), "premium");
eq("active user with an expired comp", effectivePlan("user", "active", comp({ access_expires_at: PAST }), NOW), "free");
eq(
  "active user with a dateless promo is free (matches getEntitlement)",
  effectivePlan("user", "active", promo({ access_expires_at: null, current_period_end: FUTURE }), NOW),
  "free",
);

// ====================================== callers use this module, not a copy
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
const entSrc = read("src", "lib", "entitlement.ts");
const adminSrc = read("src", "lib", "admin", "users.ts");

eq("entitlement.ts imports resolvePlan", /from\s+["']@\/lib\/entitlement-core["']/.test(entSrc), true);
eq("entitlement.ts calls resolvePlan", /resolvePlan\(/.test(entSrc), true);
eq("entitlement.ts keeps no inline expiry closures", /periodLive|notExpired/.test(entSrc), false);
// The suspended rule is enforced before the subscription is even read.
eq(
  "entitlement.ts returns for a locked account before reading subscriptions",
  entSrc.indexOf('accountStatus !== "active"') > -1 &&
    entSrc.indexOf('accountStatus !== "active"') < entSrc.indexOf('.from("subscriptions")'),
  true,
);
eq("admin/users.ts imports effectivePlan", /from\s+["']@\/lib\/entitlement-core["']/.test(adminSrc), true);
eq("admin/users.ts keeps no local plan rule", /function\s+(effectivePlan|periodLive|live)\s*\(/.test(adminSrc), false);

console.log(`entitlement-core: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
