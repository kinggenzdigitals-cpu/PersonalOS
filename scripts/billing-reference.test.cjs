"use strict";
/**
 * Tests for the checkout reference format. Compiled to .tmp-test by
 * "test:billing-reference", then run on bare node — no dependencies.
 */
const R = require("../.tmp-test/billing-reference.js");

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
const check = (label, ok) => eq(label, ok, true);

const U = "0b9c5c1e-7f2a-4c3d-9e8f-1a2b3c4d5e6f";
const P = "3f1e2d4c-5b6a-4987-8a1b-2c3d4e5f6a7b";
const NOW = 1757900000000;

// --- Round trips ------------------------------------------------------------
for (const plan of ["pro", "premium"]) {
  for (const period of ["monthly", "quarterly", "semiannual", "annual"]) {
    eq(
      `subscription ${plan}/${period} round-trips`,
      R.parseReference(R.buildSubscriptionReference(U, plan, period, NOW)),
      { kind: "subscription", userId: U, plan, period },
    );
  }
}
eq("lifetime round-trips", R.parseReference(R.buildLifetimeReference(U, "premium", NOW)), {
  kind: "lifetime",
  userId: U,
  plan: "premium",
});
eq("promo round-trips", R.parseReference(R.buildPromoReference(U, P, NOW)), {
  kind: "promo",
  userId: U,
  promoCodeId: P,
});

// --- The marker getLifetimeSold() counts ------------------------------------
check("lifetime references carry _lifetime_", R.buildLifetimeReference(U, "premium", NOW).includes("_lifetime_"));
check(
  "subscription references never carry _lifetime_",
  !R.buildSubscriptionReference(U, "premium", "annual", NOW).includes("_lifetime_"),
);

eq("period lengths", R.PERIOD_MONTHS, { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 });
check("isUuid accepts a uuid", R.isUuid(U));
check("isUuid rejects junk", !R.isUuid("abc"));

// --- Everything else is refused ---------------------------------------------
const REJECT = [
  ["a number", 42],
  ["null", null],
  ["empty string", ""],
  ["oversized", `sub_${"a".repeat(300)}`],
  ["non-uuid user", `sub_not-a-user_pro_monthly_${NOW}`],
  ["injection-shaped user", `sub_' or 1=1 --_pro_monthly_${NOW}`],
  ["unknown plan", `sub_${U}_enterprise_monthly_${NOW}`],
  ["legacy 'yearly' period", `sub_${U}_pro_yearly_${NOW}`],
  ["unknown period", `sub_${U}_pro_weekly_${NOW}`],
  ["prototype key as period", `sub_${U}_pro_toString_${NOW}`],
  ["missing timestamp", `sub_${U}_pro_monthly`],
  ["non-numeric timestamp", `sub_${U}_pro_monthly_abc`],
  ["extra segment", `sub_${U}_pro_monthly_extra_${NOW}`],
  ["wrong prefix", `subscription_${U}_pro_monthly_${NOW}`],
  ["old 4-part subscription format", `sub_${U}_monthly_${NOW}`],
  ["promo without a code", `promo_${U}_${NOW}`],
];
for (const [label, value] of REJECT) eq(`rejects ${label}`, R.parseReference(value), null);

console.log(`billing-reference: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
