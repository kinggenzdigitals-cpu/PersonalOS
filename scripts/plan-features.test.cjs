/**
 * Tests for the pricing claims — the comparison table and the plan-card
 * bullets, which are the same promise made twice on the same screen.
 *
 * They exist because the two drifted. The table was audited down to what the
 * code does; the bullets were not, and went on advertising PDF exports, saved
 * searches, an "Agenda" calendar and priority support (none of which exist)
 * plus a "current-month CSV" for Free, which the export action rejects before
 * reading a row. Those bullets render with a green tick directly above the
 * Upgrade button, and they are the only pricing copy a signed-out prospect
 * ever sees — the corrected table never reaches /pricing at all.
 *
 * So: every claim in a bullet must be backed by a row in the table, and no
 * surface may promise a feature that has not shipped.
 */
const assert = require("assert");
const { FEATURE_SECTIONS, PLAN_BULLETS } = require("../.tmp-test/plan-features.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}\n      ${err.message}`);
  }
}

const TIERS = ["free", "pro", "premium"];
const ROWS = FEATURE_SECTIONS.flatMap((s) => s.rows);

/** Rows are looked up by label prefix so a parenthetical can be reworded freely. */
function row(prefix) {
  const found = ROWS.filter((r) => r.label.startsWith(prefix));
  assert.ok(found.length === 1, `expected exactly 1 row starting "${prefix}", found ${found.length}`);
  return found[0];
}

// ---- the table only describes things that exist ---------------------------

test("every cell is a tick, a cross, or a non-empty string", () => {
  for (const r of ROWS) {
    assert.ok(r.label.trim().length > 0, "a row has a blank label");
    for (const tier of TIERS) {
      const v = r[tier];
      assert.ok(
        typeof v === "boolean" || (typeof v === "string" && v.trim().length > 0),
        `${r.label} / ${tier}: ${JSON.stringify(v)}`,
      );
    }
  }
});

test("no surface says 'coming soon'", () => {
  // A comparison table is the wrong place to make a promise: under Free it
  // reads as "coming to you" for a feature modelled as paid-only, and across
  // all three columns the row stops comparing anything. Drop the row until the
  // feature ships.
  const soon = /coming soon/i;
  for (const r of ROWS) {
    assert.ok(!soon.test(r.label), `row label promises: ${r.label}`);
    for (const tier of TIERS) {
      assert.ok(!soon.test(String(r[tier])), `${r.label} / ${tier} promises: ${r[tier]}`);
    }
  }
  for (const tier of TIERS) {
    for (const b of PLAN_BULLETS[tier]) assert.ok(!soon.test(b), `${tier} bullet promises: ${b}`);
  }
});

test("nothing advertises a feature with no implementation behind it", () => {
  // Each of these was sold at some point and none of it exists: no PDF
  // generator, no saved_searches table, no push subscription flow, no WebAuthn,
  // no queued offline write, and no tiering of support. Adding the feature is
  // what unlocks the words.
  const UNBACKED = [
    /\bPDF\b/i,
    /saved search/i,
    /\bagenda\b/i,
    /passkey/i,
    /priority support/i,
    /offline draft/i,
    /push (notification|reminder)/i,
  ];
  const surfaces = [
    ...ROWS.map((r) => [`row "${r.label}"`, [r.label, ...TIERS.map((t) => String(r[t]))].join(" ")]),
    ...TIERS.flatMap((t) => PLAN_BULLETS[t].map((b) => [`${t} bullet`, b])),
  ];
  for (const [where, text] of surfaces) {
    for (const re of UNBACKED) {
      assert.ok(!re.test(text), `${where} claims ${re}: ${text}`);
    }
  }
});

test("paid tiers never offer less than a cheaper one", () => {
  for (const r of ROWS) {
    const nums = TIERS.map((t) => (typeof r[t] === "string" ? Number(r[t].replace(/,/g, "")) : NaN));
    if (nums.some((n) => Number.isNaN(n))) continue;
    assert.ok(nums[0] <= nums[1] && nums[1] <= nums[2], `${r.label}: ${nums.join(" > ")}`);
  }
});

// ---- the bullets keep the shape their renderers assume --------------------

test("paid tiers lead with 'Everything in …' and Free does not", () => {
  // upgrade-provider.tsx renders features.slice(1, 4) as the three headline
  // claims, and account/plan-card strip any line starting with "Everything".
  // Both break quietly if that first line moves or disappears.
  assert.ok(PLAN_BULLETS.pro[0].startsWith("Everything in Free"), PLAN_BULLETS.pro[0]);
  assert.ok(PLAN_BULLETS.premium[0].startsWith("Everything in Pro"), PLAN_BULLETS.premium[0]);
  assert.ok(!PLAN_BULLETS.free[0].startsWith("Everything"), PLAN_BULLETS.free[0]);
  for (const tier of TIERS) {
    const rest = PLAN_BULLETS[tier].slice(1);
    assert.ok(rest.length >= 3, `${tier} has too few bullets to fill the upsell card`);
    assert.ok(!rest.some((b) => b.startsWith("Everything")), `${tier} repeats an "Everything" line`);
    assert.strictEqual(new Set(PLAN_BULLETS[tier]).size, PLAN_BULLETS[tier].length, `${tier} repeats a bullet`);
    for (const b of PLAN_BULLETS[tier]) assert.ok(b.trim().length > 0, `${tier} has a blank bullet`);
  }
});

// ---- every bullet is backed by a row of the table -------------------------

test("a number in a bullet matches the table cell it comes from", () => {
  const COUNTS = [
    { re: /([\d,]+) transactions/, prefix: "Transactions / month" },
    { re: /([\d,]+) wallets?/, prefix: "Wallets / accounts" },
    { re: /([\d,]+) habits?/, prefix: "Active habits" },
    { re: /([\d,]+) goals?/, prefix: "Savings goals" },
    { re: /([\d,]+) budgets?/, prefix: "Active budgets" },
    { re: /([\d,]+) recurring/, prefix: "Recurring schedules" },
    { re: /([\d,]+) reminder times?/, prefix: "Reminder times stored" },
  ];
  for (const tier of TIERS) {
    for (const bullet of PLAN_BULLETS[tier]) {
      for (const { re, prefix } of COUNTS) {
        const m = bullet.match(re);
        if (!m) continue;
        assert.strictEqual(m[1], row(prefix)[tier], `${tier}: "${bullet}" vs ${prefix}`);
      }
    }
  }
});

test("a claimed report history matches the table", () => {
  for (const tier of TIERS) {
    for (const bullet of PLAN_BULLETS[tier]) {
      const m = bullet.match(/(\d+)-(month|year) report history/);
      if (!m) continue;
      assert.strictEqual(row("Report history")[tier], `${m[1]} ${m[2]}${m[1] === "1" ? "" : "s"}`, bullet);
    }
  }
});

test("no bullet claims a capability its own column is missing", () => {
  // The regression in one line: Free's "Basic reports + current-month CSV"
  // survived a diff that had just marked CSV export unavailable on Free.
  const CLAIMS = [
    { re: /\bCSV\b/i, prefix: "CSV export" },
    { re: /net worth/i, prefix: "Net worth tracking" },
    { re: /brand colours/i, prefix: "Custom brand colours" },
    { re: /calendar/i, prefix: "Calendar views" },
    { re: /report/i, prefix: "Report history" },
    { re: /charts?/i, prefix: "Financial charts" },
    { re: /\bPWA\b/i, prefix: "PWA install" },
    { re: /privacy mode/i, prefix: "Hide sensitive info" },
    { re: /feedback/i, prefix: "In-app feedback board" },
  ];
  for (const tier of TIERS) {
    for (const bullet of PLAN_BULLETS[tier]) {
      for (const { re, prefix } of CLAIMS) {
        if (!re.test(bullet)) continue;
        assert.notStrictEqual(row(prefix)[tier], false, `${tier} claims "${bullet}" but ${prefix} is ✗ for ${tier}`);
      }
    }
  }
});

console.log(`plan-features: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
