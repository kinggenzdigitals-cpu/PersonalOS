"use strict";
/**
 * Tests for the promo redemption rules. Compiled to .tmp-test by
 * "test:promo-redemption", then run on bare node — no dependencies.
 */
const {
  PENDING_HOLD_MS,
  pendingCutoffIso,
  ownRedemptionAction,
  INVALID_PROMO_MESSAGE,
  isRedeemable,
  PROMO_USER_ATTEMPTS,
  PROMO_GLOBAL_INVALID_ATTEMPTS,
  promoAttemptBlocked,
} = require("../.tmp-test/promo-redemption.js");

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

const NOW = Date.parse("2026-09-16T12:00:00Z");

// --- The pending hold ---------------------------------------------------------
eq("hold is 24 hours", PENDING_HOLD_MS, 24 * 60 * 60 * 1000);
eq("cutoff is exactly now minus 24h", pendingCutoffIso(NOW), "2026-09-15T12:00:00.000Z");

// --- The caller's own earlier row ------------------------------------------------
const ref = "promo_00000000-0000-0000-0000-000000000001_code_1758000000000";
eq("no row: insert a new one", ownRedemptionAction(null), "new");
eq("pending: resume it", ownRedemptionAction({ status: "pending", invoice_external_id: ref }), "resume");
eq("expired (released hold): resume it", ownRedemptionAction({ status: "expired", invoice_external_id: ref }), "resume");
eq("active: already used", ownRedemptionAction({ status: "active", invoice_external_id: ref }), "used");
eq("active free promo (no reference): already used", ownRedemptionAction({ status: "active", invoice_external_id: null }), "used");
eq("canceled: already used", ownRedemptionAction({ status: "canceled", invoice_external_id: ref }), "used");
eq("pending with no reference can't be resumed", ownRedemptionAction({ status: "pending", invoice_external_id: null }), "used");

// --- Invalid codes all look the same ---------------------------------------------
const code = (over) => ({ active: true, expires_at: null, ...over });
eq("missing code", isRedeemable(null, NOW), false);
eq("paused code", isRedeemable(code({ active: false }), NOW), false);
eq("expired code", isRedeemable(code({ expires_at: "2026-09-16T11:59:59Z" }), NOW), false);
eq("code expiring exactly now", isRedeemable(code({ expires_at: "2026-09-16T12:00:00Z" }), NOW), false);
eq("live code with no end date", isRedeemable(code(), NOW), true);
eq("live code with a future end date", isRedeemable(code({ expires_at: "2026-10-01T00:00:00Z" }), NOW), true);
eq("the invalid message names no reason", /expired|active|found|paused/i.test(INVALID_PROMO_MESSAGE), false);

// --- Throttle (counts include the attempt being decided) ------------------------
eq("limit is 10 per account", PROMO_USER_ATTEMPTS, 10);
eq("first attempt passes", promoAttemptBlocked(1, 1), null);
eq("10th attempt in the hour passes", promoAttemptBlocked(10, 0), null);
eq("11th attempt in the hour is refused", typeof promoAttemptBlocked(11, 0), "string");
eq("12th attempt in the hour is refused", typeof promoAttemptBlocked(12, 0), "string");
eq("per-account message says an hour", /hour/.test(promoAttemptBlocked(11, 0) || ""), true);
eq("global ceiling passes at the limit", promoAttemptBlocked(1, PROMO_GLOBAL_INVALID_ATTEMPTS), null);
eq(
  "global ceiling refuses above it, even on an account's first attempt",
  typeof promoAttemptBlocked(1, PROMO_GLOBAL_INVALID_ATTEMPTS + 1),
  "string",
);

console.log(`promo-redemption: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
