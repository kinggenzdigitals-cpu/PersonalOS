"use strict";
/**
 * Tests for the pure Founding Lifetime offer resolver. Compiled to .tmp-test by
 * the "test:offer-config" script, then run on bare node — no dependencies.
 */
const { lifetimeOfferState } = require("../.tmp-test/offer-config.js");

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

const BASE = {
  active: true,
  maxRedemptions: 100,
  sold: 0,
  endsAt: null,
  nowMs: 1_780_000_000_000, // ~2026-05, so 2020 is past and 2999 is future
  launchPriceUSD: 99,
  regularPriceUSD: 149,
};
const S = (over) => lifetimeOfferState({ ...BASE, ...over });

// --- Availability ----------------------------------------------------------
eq("fresh offer is available at launch price", S().available, true);
eq("fresh offer price is the launch price", S().priceUSD, 99);
eq("regular is always exposed", S().regularUSD, 149);

eq("inactive offer is unavailable", S({ active: false }).available, false);
eq("inactive offer charges regular", S({ active: false }).priceUSD, 149);

// --- Count-based scarcity --------------------------------------------------
eq("partial sales leave remaining", S({ sold: 73 }).remaining, 27);
eq("still available with slots left", S({ sold: 99 }).available, true);
eq("exactly at cap is sold out", S({ sold: 100 }).soldOut, true);
eq("sold out is not available", S({ sold: 100 }).available, false);
eq("sold out remaining clamps to 0", S({ sold: 100 }).remaining, 0);
eq("oversold clamps to 0, not negative", S({ sold: 130 }).remaining, 0);
eq("sold out charges regular price", S({ sold: 100 }).priceUSD, 149);
eq("no cap means null remaining", S({ maxRedemptions: null }).remaining, null);
eq("no cap is never sold out", S({ maxRedemptions: null, sold: 9999 }).soldOut, false);
eq("negative sold treated as 0", S({ sold: -5 }).remaining, 100);
eq("fractional sold floored", S({ sold: 10.9 }).remaining, 90);

// --- Time-based expiry -----------------------------------------------------
eq("past deadline is expired", S({ endsAt: "2020-01-01T00:00:00Z" }).expired, true);
eq("expired is unavailable", S({ endsAt: "2020-01-01T00:00:00Z" }).available, false);
eq(
  "future deadline is not expired",
  S({ endsAt: "2999-01-01T00:00:00Z" }).expired,
  false,
);
eq("null deadline never expires by time", S({ endsAt: null }).expired, false);
eq(
  "unparseable deadline does not expire the offer",
  S({ endsAt: "not-a-date" }).expired,
  false,
);
eq(
  "unparseable deadline leaves it available",
  S({ endsAt: "not-a-date" }).available,
  true,
);

// --- Combined --------------------------------------------------------------
eq(
  "sold out AND expired is still unavailable",
  S({ sold: 100, endsAt: "2020-01-01T00:00:00Z" }).available,
  false,
);

console.log(`offer-config: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
