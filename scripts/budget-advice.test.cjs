/**
 * Tests for the monthly-budget recommendation rules.
 *
 * Run via `npm run test:budget`, which compiles src/lib/budget-advice.ts to
 * .tmp-test first (same approach as the csv and reconcile suites).
 */
const assert = require("assert");
const {
  buildBudgetRecommendations,
  money,
  MAX_RECOMMENDATIONS,
} = require("../.tmp-test/budget-advice.js");

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

/** A balanced month that produces no advice, for tests to vary one field of. */
function base(over = {}) {
  return {
    hasMonthlyBudget: true,
    total: 20000,
    savingsTarget: 0,
    savingsFunded: 0,
    spent: 0,
    unallocated: 0,
    dayOfMonth: 10,
    daysInMonth: 30,
    daysLeft: 20,
    items: [],
    ...over,
  };
}

function item(over = {}) {
  return {
    name: "Groceries",
    amount: 5000,
    spent: 0,
    remaining: 5000,
    pct: 0,
    ...over,
  };
}

const texts = (r) => r.map((x) => x.text);
const joined = (r) => texts(r).join(" | ");

// ---- gating ---------------------------------------------------------------

test("no advice at all when no monthly budget is set", () => {
  const r = buildBudgetRecommendations(
    base({ hasMonthlyBudget: false, unallocated: 5000, spent: 999999 }),
  );
  assert.deepStrictEqual(r, []);
});

test("a balanced month produces no advice", () => {
  assert.deepStrictEqual(buildBudgetRecommendations(base()), []);
});

// ---- allocation coverage --------------------------------------------------

test("unallocated money is reported", () => {
  const r = buildBudgetRecommendations(base({ unallocated: 3500 }));
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].tone, "info");
  assert.match(r[0].text, /3,500 left to allocate/);
});

test("over-allocation warns and shows a POSITIVE amount", () => {
  const r = buildBudgetRecommendations(base({ unallocated: -1200 }));
  assert.strictEqual(r[0].tone, "warn");
  assert.match(r[0].text, /over-allocated by ₱1,200\./);
  // Regression guard: the value is negative internally and must not print
  // as "-P1,200" after the copy already says "over-allocated by".
  assert.ok(!r[0].text.includes("-₱"), `leaked minus sign: ${r[0].text}`);
});

test("rounding noise under half a peso is not flagged either way", () => {
  assert.deepStrictEqual(
    buildBudgetRecommendations(base({ unallocated: 0.4 })),
    [],
  );
  assert.deepStrictEqual(
    buildBudgetRecommendations(base({ unallocated: -0.4 })),
    [],
  );
});

// ---- overall spending -----------------------------------------------------

test("spending past the overall budget warns", () => {
  const r = buildBudgetRecommendations(base({ spent: 21000 }));
  assert.match(joined(r), /spent ₱21,000/);
  assert.match(joined(r), /more than your ₱20,000 budget/);
});

test("spending exactly at the budget does not warn", () => {
  assert.deepStrictEqual(buildBudgetRecommendations(base({ spent: 20000 })), []);
});

// ---- per-category ---------------------------------------------------------

test("a category over budget reports the overspend as positive", () => {
  const r = buildBudgetRecommendations(
    base({ items: [item({ spent: 6000, remaining: -1000, pct: 120 })] }),
  );
  assert.match(r[0].text, /Groceries is over by ₱1,000\./);
  assert.ok(!r[0].text.includes("-₱"));
});

test("a category at 80% warns with the days remaining", () => {
  const r = buildBudgetRecommendations(
    base({
      daysLeft: 1,
      items: [item({ spent: 4000, remaining: 1000, pct: 80 })],
    }),
  );
  assert.match(r[0].text, /Groceries is at 80% with 1 day left\./);
});

test("days are pluralised above one", () => {
  const r = buildBudgetRecommendations(
    base({
      daysLeft: 3,
      items: [item({ spent: 4000, remaining: 1000, pct: 80 })],
    }),
  );
  assert.match(r[0].text, /with 3 days left/);
});

test("the 80% warning is suppressed on the last day of the month", () => {
  const r = buildBudgetRecommendations(
    base({
      dayOfMonth: 30,
      daysLeft: 0,
      items: [item({ spent: 4000, remaining: 1000, pct: 80 })],
    }),
  );
  // No days remain, so "with 0 days left" would be useless advice.
  assert.ok(!joined(r).includes("80%"), joined(r));
});

test("a category with no name falls back to a generic label", () => {
  const r = buildBudgetRecommendations(
    base({
      items: [item({ name: null, spent: 6000, remaining: -1000, pct: 120 })],
    }),
  );
  assert.match(r[0].text, /^A category is over by/);
});

test("an empty-string category name also falls back", () => {
  const r = buildBudgetRecommendations(
    base({
      items: [item({ name: "", spent: 6000, remaining: -1000, pct: 120 })],
    }),
  );
  assert.match(r[0].text, /^A category is over by/);
});

// ---- pace forecast --------------------------------------------------------

test("pace forecast projects to month-end", () => {
  // 2,000 by day 10 of 30 -> 6,000 projected against a 5,000 budget.
  const r = buildBudgetRecommendations(
    base({ items: [item({ spent: 2000, remaining: 3000, pct: 40 })] }),
  );
  assert.match(joined(r), /on track for about ₱6,000 by month-end/);
  assert.match(joined(r), /\(budget ₱5,000\)/);
});

test("no pace forecast before day 5 - too little data to extrapolate", () => {
  const r = buildBudgetRecommendations(
    base({
      dayOfMonth: 3,
      items: [item({ spent: 2000, remaining: 3000, pct: 40 })],
    }),
  );
  assert.deepStrictEqual(r, []);
});

test("pace forecast needs to exceed the budget by more than 5%", () => {
  // 500 by day 10 of 30 -> 1,500 projected, well under a 5,000 budget.
  const r = buildBudgetRecommendations(
    base({ items: [item({ spent: 500, remaining: 4500, pct: 10 })] }),
  );
  assert.deepStrictEqual(r, []);
});

test("a category with no spending yet is left alone", () => {
  assert.deepStrictEqual(buildBudgetRecommendations(base({ items: [item()] })), []);
});

test("over-budget takes precedence over the pace forecast", () => {
  const r = buildBudgetRecommendations(
    base({ items: [item({ spent: 6000, remaining: -1000, pct: 120 })] }),
  );
  assert.strictEqual(r.length, 1);
  assert.ok(!joined(r).includes("on track"));
});

// ---- savings --------------------------------------------------------------

test("a fully funded savings target reads as success", () => {
  const r = buildBudgetRecommendations(
    base({ savingsTarget: 5000, savingsFunded: 5000 }),
  );
  assert.strictEqual(r[0].tone, "success");
  assert.match(r[0].text, /Savings funded: ₱5,000 moved to savings/);
});

test("over-funding savings still reads as success", () => {
  const r = buildBudgetRecommendations(
    base({ savingsTarget: 5000, savingsFunded: 7000 }),
  );
  assert.strictEqual(r[0].tone, "success");
});

test("a savings gap early in the month is informational", () => {
  const r = buildBudgetRecommendations(
    base({ savingsTarget: 5000, savingsFunded: 2000, daysLeft: 20 }),
  );
  assert.strictEqual(r[0].tone, "info");
  assert.match(r[0].text, /₱2,000 of ₱5,000 moved so far/);
  assert.match(r[0].text, /₱3,000 to go/);
});

test("a savings gap near month-end escalates to a warning", () => {
  const r = buildBudgetRecommendations(
    base({ savingsTarget: 5000, savingsFunded: 2000, daysLeft: 3 }),
  );
  assert.strictEqual(r[0].tone, "warn");
  assert.match(r[0].text, /₱3,000 of your savings allocation is still unfunded/);
  assert.match(r[0].text, /with 3 days left/);
});

test("no savings advice when no savings target is set", () => {
  assert.deepStrictEqual(
    buildBudgetRecommendations(base({ savingsFunded: 4000 })),
    [],
  );
});

// ---- ordering and cap -----------------------------------------------------

test("warnings are listed before informational notes", () => {
  const r = buildBudgetRecommendations(
    base({
      unallocated: 1000, // info
      spent: 25000, // warn
    }),
  );
  assert.strictEqual(r[0].tone, "warn");
  assert.strictEqual(r[1].tone, "info");
});

test("the list is capped so the card stays scannable", () => {
  const items = Array.from({ length: 12 }, (_, i) =>
    item({ name: `Cat ${i}`, spent: 6000, remaining: -1000, pct: 120 }),
  );
  const r = buildBudgetRecommendations(base({ items }));
  assert.strictEqual(r.length, MAX_RECOMMENDATIONS);
});

test("warnings survive the cap even when info items outnumber them", () => {
  const items = Array.from({ length: 8 }, (_, i) =>
    item({ name: `Cat ${i}`, spent: 2000, remaining: 3000, pct: 40 }),
  );
  const r = buildBudgetRecommendations(base({ items, spent: 25000 }));
  assert.strictEqual(r[0].tone, "warn");
  assert.strictEqual(r.length, MAX_RECOMMENDATIONS);
});

// ---- currency -------------------------------------------------------------

test("the currency symbol is honoured", () => {
  const r = buildBudgetRecommendations(base({ unallocated: 1000 }), "$");
  assert.match(r[0].text, /\$1,000/);
});

test("money() rounds, absolutes, and groups thousands", () => {
  assert.strictEqual(money(1234.56, "₱"), "₱1,235");
  assert.strictEqual(money(-1234.56, "₱"), "₱1,235");
  assert.strictEqual(money(0, "₱"), "₱0");
  assert.strictEqual(money(1000000, "₱"), "₱1,000,000");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
