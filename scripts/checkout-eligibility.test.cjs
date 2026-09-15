"use strict";
/**
 * Tests for the checkout-start rule and the payment-arrival rule. Compiled to
 * .tmp-test by "test:checkout-eligibility", then run on bare node.
 */
const {
  checkoutBlockReason,
  isAccessLive,
  activationConflict,
} = require("../.tmp-test/checkout-eligibility.js");

let passed = 0;
let failed = 0;
function check(label, ok, detail) {
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}${detail ? `\n    ${detail}` : ""}`);
  }
}
const allowed = (label, r) => check(label, r === null, `expected allowed, got ${JSON.stringify(r)}`);
const blocked = (label, r) =>
  check(label, typeof r === "string" && r.length > 0, `expected a block reason, got ${JSON.stringify(r)}`);

// =================================================== checkoutBlockReason
const acct = (accessType, plan, isSuperAdmin = false) => ({ isSuperAdmin, accessType, plan });
const KINDS = ["subscription", "promo", "lifetime"];

for (const k of KINDS) allowed(`free (no row): ${k}`, checkoutBlockReason(acct(null, "free"), k, "pro"));

for (const plan of ["premium", "pro"]) {
  for (const k of KINDS) blocked(`lifetime ${plan}: ${k}`, checkoutBlockReason(acct("lifetime_pro", plan), k, "premium"));
}
check(
  "lifetime message names lifetime",
  /lifetime/i.test(checkoutBlockReason(acct("lifetime_pro", "premium"), "subscription", "pro") || ""),
);
for (const k of KINDS) blocked(`super admin: ${k}`, checkoutBlockReason(acct(null, "premium", true), k, "premium"));

blocked("live comp: subscription would overwrite it", checkoutBlockReason(acct("complimentary_pro", "pro"), "subscription", "premium"));
blocked("live comp: promo would overwrite it", checkoutBlockReason(acct("complimentary_pro", "premium"), "promo"));
allowed("live comp: converting to lifetime only adds access", checkoutBlockReason(acct("complimentary_pro", "pro"), "lifetime"));
for (const k of KINDS) allowed(`expired comp: ${k}`, checkoutBlockReason(acct("complimentary_pro", "free"), k, "pro"));

allowed("paid Pro: renewing Pro extends", checkoutBlockReason(acct("paid", "pro"), "subscription", "pro"));
allowed("paid Pro: upgrading to Premium", checkoutBlockReason(acct("paid", "pro"), "subscription", "premium"));
allowed("paid Premium: renewing Premium extends", checkoutBlockReason(acct("paid", "premium"), "subscription", "premium"));
blocked("paid Premium: buying Pro would downgrade paid Premium time", checkoutBlockReason(acct("paid", "premium"), "subscription", "pro"));
allowed("paid: may convert to lifetime", checkoutBlockReason(acct("paid", "premium"), "lifetime"));
blocked("paid: promo would cut the paid period short", checkoutBlockReason(acct("paid", "premium"), "promo"));
for (const k of KINDS) allowed(`lapsed paid: ${k}`, checkoutBlockReason(acct("paid", "free"), k, "pro"));

allowed("active Pro promo: may buy a plan", checkoutBlockReason(acct("promo", "pro"), "subscription", "pro"));
blocked("active Premium promo: buying Pro would downgrade", checkoutBlockReason(acct("promo", "premium"), "subscription", "pro"));
allowed("active promo: may buy lifetime", checkoutBlockReason(acct("promo", "pro"), "lifetime"));
blocked("active promo: a second promo would reset the period", checkoutBlockReason(acct("promo", "pro"), "promo"));

// ============================================================ isAccessLive
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

check("no row is not live", !isAccessLive(null, NOW));
check("lifetime is always live", isAccessLive(row({ access_type: "lifetime_pro", current_period_end: null }), NOW));
check("comp with no end date is live forever", isAccessLive(row({ access_type: "complimentary_pro", access_expires_at: null }), NOW));
check("comp with a future end is live", isAccessLive(row({ access_type: "complimentary_pro", access_expires_at: FUTURE }), NOW));
check("comp with a past end is not live", !isAccessLive(row({ access_type: "complimentary_pro", access_expires_at: PAST }), NOW));
check("promo with a future end is live", isAccessLive(row({ access_type: "promo", access_expires_at: FUTURE }), NOW));
check("promo with no end is not live", !isAccessLive(row({ access_type: "promo", access_expires_at: null }), NOW));
check("paid with a future end is live", isAccessLive(row(), NOW));
check("paid with a past end is not live", !isAccessLive(row({ current_period_end: PAST }), NOW));
check("paid with no end is not live", !isAccessLive(row({ current_period_end: null }), NOW));
check("paid but status not active is not live", !isAccessLive(row({ status: "canceled" }), NOW));
check("unparseable end date is not live", !isAccessLive(row({ current_period_end: "garbage" }), NOW));

// ====================================================== activationConflict
const pay = (kind, plan = null) => ({ kind, plan });

blocked("lifetime held: subscription payment", activationConflict(row({ access_type: "lifetime_pro" }), pay("subscription", "pro"), NOW));
blocked("lifetime held: promo payment", activationConflict(row({ access_type: "lifetime_pro" }), pay("promo"), NOW));
blocked("lifetime held: SECOND lifetime payment", activationConflict(row({ access_type: "lifetime_pro" }), pay("lifetime", "premium"), NOW));
check(
  "second lifetime is described as such (for the refund log)",
  /second lifetime/i.test(activationConflict(row({ access_type: "lifetime_pro" }), pay("lifetime", "premium"), NOW) || ""),
);

allowed("no row: subscription", activationConflict(null, pay("subscription", "pro"), NOW));
allowed("no row: promo", activationConflict(null, pay("promo"), NOW));
allowed("no row: lifetime", activationConflict(null, pay("lifetime", "premium"), NOW));

blocked("live paid: stale promo session paid later", activationConflict(row(), pay("promo"), NOW));
allowed("expired paid: promo", activationConflict(row({ current_period_end: PAST }), pay("promo"), NOW));
blocked("live promo: another promo", activationConflict(row({ access_type: "promo", access_expires_at: FUTURE }), pay("promo"), NOW));

blocked(
  "live comp: stale subscription session paid later",
  activationConflict(row({ access_type: "complimentary_pro", access_expires_at: null }), pay("subscription", "premium"), NOW),
);
allowed(
  "expired comp: subscription",
  activationConflict(row({ access_type: "complimentary_pro", access_expires_at: PAST }), pay("subscription", "pro"), NOW),
);
allowed("live comp: lifetime only adds access", activationConflict(row({ access_type: "complimentary_pro" }), pay("lifetime", "premium"), NOW));

blocked("live paid Premium: Pro payment would downgrade", activationConflict(row({ plan: "premium" }), pay("subscription", "pro"), NOW));
blocked(
  "live Premium promo: Pro payment would downgrade",
  activationConflict(row({ plan: "premium", access_type: "promo", access_expires_at: FUTURE }), pay("subscription", "pro"), NOW),
);
allowed("live paid Pro: Premium upgrade", activationConflict(row({ plan: "pro" }), pay("subscription", "premium"), NOW));
allowed("live paid Premium: Premium renewal", activationConflict(row({ plan: "premium" }), pay("subscription", "premium"), NOW));
allowed("expired Premium: Pro payment", activationConflict(row({ plan: "premium", current_period_end: PAST }), pay("subscription", "pro"), NOW));
allowed("live paid: lifetime", activationConflict(row({ plan: "premium" }), pay("lifetime", "premium"), NOW));

// The two rules must agree: whatever checkout refuses to START, arrival refuses to APPLY.
check(
  "rules agree on the Premium -> Pro downgrade",
  checkoutBlockReason(acct("paid", "premium"), "subscription", "pro") !== null &&
    activationConflict(row({ plan: "premium" }), pay("subscription", "pro"), NOW) !== null,
);

console.log(`checkout-eligibility: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
