/**
 * Tests for the budget vs. actual report maths.
 *
 * Run via `npm run test:budget-report`, which compiles src/lib/budget-report.ts
 * to .tmp-test first (same approach as the csv, reconcile and budget suites).
 */
const assert = require("assert");
const {
  buildBudgetReport,
  budgetEnvelope,
  budgetStatus,
  monthlyBudgetTotals,
  statusLabel,
} = require("../.tmp-test/budget-report.js");

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

/** Builds a report from shorthand, so each test only states what it varies. */
function report(budgets, actuals, extra) {
  return buildBudgetReport({
    budgets: budgets.map(([categoryId, categoryName, amount]) => ({
      categoryId,
      categoryName,
      amount,
    })),
    actualByCategory: actuals.map(([categoryId, categoryName, amount]) => ({
      categoryId,
      categoryName,
      amount,
    })),
    ...(extra || {}),
  });
}

const row = (r, name) => r.rows.find((x) => x.categoryName === name);
const names = (r) => r.rows.map((x) => x.categoryName);

/**
 * Walks every number in the report. A single NaN or Infinity leaking into a
 * row renders as "NaN%" in the table and silently poisons every total derived
 * from it, so the guard is structural rather than field-by-field.
 */
function assertAllFinite(value, path) {
  if (typeof value === "number") {
    assert.ok(
      Number.isFinite(value),
      `${path} is ${value} — NaN/Infinity must never reach the table`,
    );
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertAllFinite(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) assertAllFinite(value[k], `${path}.${k}`);
  }
}

// ---- the spec's worked example --------------------------------------------

test("spec example: Food budget 5,000 with 6,500 spent", () => {
  const r = report([["c1", "Food", 5000]], [["c1", "Food", 6500]]);
  const food = row(r, "Food");
  assert.strictEqual(food.budget, 5000);
  assert.strictEqual(food.actual, 6500);
  assert.strictEqual(food.remaining, -1500);
  assert.strictEqual(food.pctUsed, 130);
  assert.strictEqual(food.status, "over");
  assert.strictEqual(statusLabel(food.status), "Over Budget");
});

test("overspend percentages stay uncapped", () => {
  // The bar caps at 100% in the UI; the number must not, or a 3x overspend
  // would be indistinguishable from a 1% one.
  const r = report([["c1", "Food", 1000]], [["c1", "Food", 3000]]);
  assert.strictEqual(row(r, "Food").pctUsed, 300);
  assert.strictEqual(r.pctUsed, 300);
});

// ---- zero and missing budgets ---------------------------------------------

test("a zero budget yields no percentage and no division by zero", () => {
  const r = report([["c1", "Food", 0]], [["c1", "Food", 6500]]);
  const food = row(r, "Food");
  assert.strictEqual(food.budget, 0);
  assert.strictEqual(food.pctUsed, null);
  assert.strictEqual(food.remaining, null);
  assert.strictEqual(food.status, "none");
  assert.strictEqual(statusLabel(food.status), "No Budget");
  assertAllFinite(r, "report");
});

test("a null budget (the Unbudgeted bucket) yields no percentage", () => {
  const r = report([], [[null, null, 900]]);
  const bucket = row(r, "Unbudgeted");
  assert.strictEqual(bucket.budget, null);
  assert.strictEqual(bucket.pctUsed, null);
  assert.strictEqual(bucket.remaining, null);
  assert.strictEqual(bucket.status, "none");
  assertAllFinite(r, "report");
});

test("budgetStatus never divides by zero", () => {
  assert.strictEqual(budgetStatus(null, 6500), "none");
  assert.strictEqual(budgetStatus(0, 6500), "none");
  assert.strictEqual(budgetStatus(0, 0), "none");
  assert.strictEqual(budgetStatus(-500, 100), "none");
});

test("an entirely empty month is a clean zero, not NaN", () => {
  const r = report([], []);
  assert.deepStrictEqual(r.rows, []);
  assert.strictEqual(r.totalBudget, 0);
  assert.strictEqual(r.totalActual, 0);
  // No budget means nothing to be remaining OF — the same rule the rows follow.
  assert.strictEqual(r.remaining, null);
  assert.strictEqual(r.pctUsed, null);
  assert.strictEqual(r.status, "none");
  assertAllFinite(r, "report");
});

// ---- status bands ---------------------------------------------------------

test("actual exactly equal to budget is At Limit with 0 remaining", () => {
  const r = report([["c1", "Food", 5000]], [["c1", "Food", 5000]]);
  const food = row(r, "Food");
  assert.strictEqual(food.status, "at");
  assert.strictEqual(food.remaining, 0);
  assert.strictEqual(food.pctUsed, 100);
  assert.strictEqual(statusLabel(food.status), "At Limit");
});

test("the band edges land where the spec says", () => {
  const at = (actual) => row(report([["c1", "Food", 1000]], [["c1", "Food", actual]]), "Food");
  assert.strictEqual(at(799).pctUsed, 79.9);
  assert.strictEqual(at(799).status, "within");
  assert.strictEqual(at(800).pctUsed, 80);
  assert.strictEqual(at(800).status, "near");
  assert.strictEqual(at(999).pctUsed, 99.9);
  assert.strictEqual(at(999).status, "near");
  assert.strictEqual(at(1000).pctUsed, 100);
  assert.strictEqual(at(1000).status, "at");
  assert.strictEqual(at(1000.1).pctUsed, 100.01);
  assert.strictEqual(at(1000.1).status, "over");
});

test("budgetStatus agrees with the report rows at every edge", () => {
  assert.strictEqual(budgetStatus(1000, 799), "within");
  assert.strictEqual(budgetStatus(1000, 800), "near");
  assert.strictEqual(budgetStatus(1000, 999), "near");
  assert.strictEqual(budgetStatus(1000, 1000), "at");
  assert.strictEqual(budgetStatus(1000, 1000.1), "over");
  assert.strictEqual(budgetStatus(1000, 0), "within");
});

test("every status has its own label", () => {
  assert.strictEqual(statusLabel("within"), "Within Budget");
  assert.strictEqual(statusLabel("near"), "Near Limit");
  assert.strictEqual(statusLabel("at"), "At Limit");
  assert.strictEqual(statusLabel("over"), "Over Budget");
  assert.strictEqual(statusLabel("none"), "No Budget");
});

// ---- share of total spending ----------------------------------------------

test("a month with no spending gives every row a 0 share, not NaN", () => {
  const r = report(
    [
      ["c1", "Food", 5000],
      ["c2", "Transport", 2000],
    ],
    [],
  );
  assert.strictEqual(r.totalActual, 0);
  for (const x of r.rows) assert.strictEqual(x.sharePct, 0);
  assertAllFinite(r, "report");
});

test("shares across all rows sum to about 100", () => {
  const r = report(
    [
      ["c1", "Food", 5000],
      ["c2", "Transport", 2000],
      ["c3", "Bills", 3000],
    ],
    [
      ["c1", "Food", 6500],
      ["c2", "Transport", 1234.56],
      ["c3", "Bills", 2999.99],
      [null, null, 777.77],
      ["c9", "Pets", 333.33],
    ],
  );
  const sum = r.rows.reduce((s, x) => s + x.sharePct, 0);
  assert.ok(Math.abs(sum - 100) < 0.05, `shares summed to ${sum}`);
});

test("a category's share is measured against ALL spending, not just budgeted", () => {
  const r = report([["c1", "Food", 1000]], [["c1", "Food", 250], [null, null, 750]]);
  assert.strictEqual(row(r, "Food").sharePct, 25);
  assert.strictEqual(row(r, "Unbudgeted").sharePct, 75);
});

// ---- the Unbudgeted bucket ------------------------------------------------

test("uncategorised and un-budgeted spending share ONE bucket", () => {
  const r = report(
    [["c1", "Food", 5000]],
    [
      ["c1", "Food", 1000],
      [null, null, 300], // uncategorised
      ["c7", "Pets", 200], // real category, no budget
      ["c8", "Gifts", 500], // real category, no budget
    ],
  );
  const buckets = r.rows.filter((x) => x.categoryId === null);
  assert.strictEqual(buckets.length, 1);
  assert.strictEqual(buckets[0].categoryName, "Unbudgeted");
  assert.strictEqual(buckets[0].actual, 1000);
  assert.strictEqual(r.unbudgetedActual, 1000);
  assert.strictEqual(r.budgetedActual, 1000);
  // Nothing may go missing: the total counts everything the person spent.
  assert.strictEqual(r.totalActual, 2000);
  assert.strictEqual(r.budgetedActual + r.unbudgetedActual, r.totalActual);
});

test("no Unbudgeted row when every peso is budgeted", () => {
  const r = report([["c1", "Food", 5000]], [["c1", "Food", 1000]]);
  assert.deepStrictEqual(names(r), ["Food"]);
  assert.strictEqual(r.unbudgetedActual, 0);
});

test("repeated rows for one category are summed, not dropped", () => {
  const r = report(
    [["c1", "Food", 5000]],
    [
      ["c1", "Food", 1000],
      ["c1", "Food", 1500],
      [null, null, 100],
      [null, null, 200],
    ],
  );
  assert.strictEqual(row(r, "Food").actual, 2500);
  assert.strictEqual(row(r, "Unbudgeted").actual, 300);
  assert.strictEqual(r.totalActual, 2800);
});

test("a budgeted category with no spending still gets a row", () => {
  const r = report([["c1", "Food", 5000]], [[null, null, 100]]);
  const food = row(r, "Food");
  assert.strictEqual(food.actual, 0);
  assert.strictEqual(food.remaining, 5000);
  assert.strictEqual(food.pctUsed, 0);
  assert.strictEqual(food.status, "within");
});

// ---- totals ---------------------------------------------------------------

test("the total is measured against ALL expenses, unbudgeted included", () => {
  const r = report(
    [
      ["c1", "Food", 5000],
      ["c2", "Transport", 5000],
    ],
    [
      ["c1", "Food", 4000],
      ["c2", "Transport", 4000],
      [null, null, 3000],
    ],
  );
  assert.strictEqual(r.totalBudget, 10000);
  assert.strictEqual(r.totalActual, 11000);
  assert.strictEqual(r.remaining, -1000);
  assert.strictEqual(r.pctUsed, 110);
  assert.strictEqual(r.status, "over");
});

test("savings target is NEVER added into the expense budget", () => {
  const r = report([["c1", "Food", 5000]], [["c1", "Food", 5000]], {
    savingsTarget: 20000,
    savingsFunded: 12000,
  });
  assert.strictEqual(r.totalBudget, 5000);
  assert.strictEqual(r.savingsTarget, 20000);
  assert.strictEqual(r.savingsFunded, 12000);
  // Folding savings in would have made this fully-spent month read 20% used.
  assert.strictEqual(r.pctUsed, 100);
  assert.strictEqual(r.status, "at");
  assert.strictEqual(r.remaining, 0);
});

test("savings fields default to zero when the caller omits them", () => {
  const r = report([["c1", "Food", 5000]], []);
  assert.strictEqual(r.savingsTarget, 0);
  assert.strictEqual(r.savingsFunded, 0);
});

test("nothing budgeted means no percentage AND no overspend", () => {
  // A person who has set no budget has not overspent one. Reporting −4,200 here
  // rendered as a red "Over budget ₱4,200" next to this very report's own
  // "No Budget" pill and "—" percentage.
  const r = report([], [[null, null, 4200]]);
  assert.strictEqual(r.totalBudget, 0);
  assert.strictEqual(r.totalActual, 4200);
  assert.strictEqual(r.pctUsed, null);
  assert.strictEqual(r.status, "none");
  assert.strictEqual(r.remaining, null);
  assertAllFinite(r, "report");
});

test("budgets that all sum to zero are treated as no budget at all", () => {
  const r = report([["c1", "Food", 0]], [["c1", "Food", 6500]]);
  assert.strictEqual(r.totalBudget, 0);
  assert.strictEqual(r.remaining, null);
  assert.strictEqual(r.pctUsed, null);
  assert.strictEqual(r.status, "none");
});

test("a real budget still reports its overspend on the totals", () => {
  const r = report([["c1", "Food", 5000]], [["c1", "Food", 6500]]);
  assert.strictEqual(r.remaining, -1500);
  assert.strictEqual(r.status, "over");
});

// ---- ordering -------------------------------------------------------------

test("budgeted rows run worst-first with Unbudgeted last", () => {
  const r = report(
    [
      ["c1", "Food", 1000], // 50%
      ["c2", "Transport", 1000], // 130%
      ["c3", "Bills", 1000], // 90%
      ["c4", "Fun", 0], // no budget in effect
    ],
    [
      ["c1", "Food", 500],
      ["c2", "Transport", 1300],
      ["c3", "Bills", 900],
      ["c4", "Fun", 400],
      [null, null, 50],
    ],
  );
  assert.deepStrictEqual(names(r), [
    "Transport",
    "Bills",
    "Food",
    "Fun",
    "Unbudgeted",
  ]);
});

test("the bucket is last even when it dwarfs every budgeted row", () => {
  const r = report([["c1", "Food", 1000]], [["c1", "Food", 5000], [null, null, 99999]]);
  assert.strictEqual(r.rows[r.rows.length - 1].categoryName, "Unbudgeted");
});

test("rows tied on percentage keep a stable, name-ordered position", () => {
  const r = report(
    [
      ["c1", "Zebra", 1000],
      ["c2", "Apple", 1000],
    ],
    [
      ["c1", "Zebra", 500],
      ["c2", "Apple", 500],
    ],
  );
  assert.deepStrictEqual(names(r), ["Apple", "Zebra"]);
});

// ---- floating point -------------------------------------------------------

test("float sums are snapped to centavos before they are displayed", () => {
  // 3499.9 + 0.1 is 3500.0000000000005 in IEEE doubles; 5000 minus that would
  // print as a remainder that does not tie back to the numbers beside it.
  const r = report(
    [["c1", "Food", 5000]],
    [
      ["c1", "Food", 3499.9],
      ["c1", "Food", 0.1],
    ],
  );
  const food = row(r, "Food");
  assert.strictEqual(food.actual, 3500);
  assert.strictEqual(food.remaining, 1500);
  assert.strictEqual(String(food.remaining), "1500");
  assert.strictEqual(r.remaining, 1500);
});

test("0.1 + 0.2 against a 0.3 budget is At Limit, not Over", () => {
  const r = report(
    [["c1", "Food", 0.3]],
    [
      ["c1", "Food", 0.1],
      ["c1", "Food", 0.2],
    ],
  );
  const food = row(r, "Food");
  assert.strictEqual(food.actual, 0.3);
  assert.strictEqual(food.remaining, 0);
  assert.strictEqual(food.status, "at");
  assert.strictEqual(budgetStatus(0.3, 0.1 + 0.2), "at");
});

test("centavo drift does not accumulate across many rows", () => {
  const actuals = Array.from({ length: 10 }, () => ["c1", "Food", 0.1]);
  const r = report([["c1", "Food", 1]], actuals);
  assert.strictEqual(row(r, "Food").actual, 1);
  assert.strictEqual(row(r, "Food").remaining, 0);
  assert.strictEqual(r.totalActual, 1);
});

// ---- defensive ------------------------------------------------------------

test("a corrupt amount collapses to zero instead of poisoning the report", () => {
  const r = buildBudgetReport({
    budgets: [{ categoryId: "c1", categoryName: "Food", amount: 5000 }],
    actualByCategory: [
      { categoryId: "c1", categoryName: "Food", amount: NaN },
      { categoryId: "c1", categoryName: "Food", amount: 1000 },
    ],
  });
  assert.strictEqual(row(r, "Food").actual, 1000);
  assertAllFinite(r, "report");
});

test("a blank category name falls back rather than rendering empty", () => {
  const r = report([["c1", "", 5000]], [["c1", "", 100]]);
  assert.strictEqual(r.rows[0].categoryName, "Untitled category");
});

// ---- per-category envelopes (carry-over) ----------------------------------

const envelope = (amount, spent, lastAmount = null, lastSpent = 0) =>
  budgetEnvelope({ amount, spent, lastAmount, lastSpent });

test("carry-over rolls last month's leftover forward", () => {
  const e = envelope(5000, 3000, 5000, 4000);
  assert.strictEqual(e.carryIn, 1000);
  assert.strictEqual(e.effective, 6000);
  assert.strictEqual(e.remaining, 3000);
  assert.strictEqual(e.pct, 50);
});

test("no carry-over leaves the envelope at the month's own allotment", () => {
  const e = envelope(5000, 3000);
  assert.strictEqual(e.carryIn, 0);
  assert.strictEqual(e.effective, 5000);
  assert.strictEqual(e.pct, 60);
});

test("an unknown last month carries in NOTHING, not a second envelope", () => {
  // A budget created this month never had an allotment last month. Standing in
  // this month's amount gave a brand-new ₱5,000 budget a ₱10,000 envelope and
  // reported 90% "near limit" for a month that is 80% over.
  const e = envelope(5000, 9000, null, 0);
  assert.strictEqual(e.carryIn, 0);
  assert.strictEqual(e.effective, 5000);
  assert.strictEqual(e.remaining, -4000);
  assert.strictEqual(e.pct, 180);
});

test("the leftover is measured against last month's amount, not this one", () => {
  // Raised from 5,000 to 8,000 with 4,000 spent last month: ₱1,000 carries in,
  // not ₱4,000. Using today's amount invented ₱3,000 of envelope.
  const e = envelope(8000, 0, 5000, 4000);
  assert.strictEqual(e.carryIn, 1000);
  assert.strictEqual(e.effective, 9000);
});

test("a carried-over overspend rolls forward as a deficit", () => {
  const e = envelope(5000, 3000, 5000, 12000);
  assert.strictEqual(e.carryIn, -7000);
  assert.strictEqual(e.effective, -2000);
  assert.strictEqual(e.remaining, -5000);
  // The old code reported exactly 100 here, and every consumer tests "over" as
  // strictly > 100 — so a ₱5,000 overspend rendered as a yellow "at 100%".
  assert.ok(e.pct > 100, `pct was ${e.pct}`);
  assert.strictEqual(e.pct, 200);
});

test("a blown envelope reads as over even with nothing spent yet", () => {
  const e = envelope(5000, 0, 5000, 12000);
  assert.strictEqual(e.remaining, -2000);
  assert.ok(e.pct > 100, `pct was ${e.pct}`);
});

test("an exactly-consumed envelope is at the limit, not over it", () => {
  const e = envelope(5000, 0, 5000, 10000);
  assert.strictEqual(e.effective, 0);
  assert.strictEqual(e.remaining, 0);
  assert.strictEqual(e.pct, 100);
  const spentAnyway = envelope(5000, 100, 5000, 10000);
  assert.strictEqual(spentAnyway.remaining, -100);
  assert.ok(spentAnyway.pct > 100, `pct was ${spentAnyway.pct}`);
});

test("pct is above 100 exactly when remaining is negative", () => {
  // The one property every consumer relies on, swept across the whole space
  // including the envelopes a carried deficit makes non-positive.
  for (const amount of [1000, 5000]) {
    for (const lastSpent of [0, 500, 1000, 5000, 12000]) {
      for (const spent of [0, 1, 999, 1000, 5000, 20000]) {
        for (const lastAmount of [null, amount]) {
          const e = envelope(amount, spent, lastAmount, lastSpent);
          assert.strictEqual(
            e.pct > 100,
            e.remaining < 0,
            `pct ${e.pct} vs remaining ${e.remaining} (amount ${amount}, spent ${spent}, lastAmount ${lastAmount}, lastSpent ${lastSpent})`,
          );
          assertAllFinite(e, "envelope");
        }
      }
    }
  }
});

// ---- monthly headline totals ----------------------------------------------

test("the savings target is not spendable, so it never inflates Remaining", () => {
  // 30,000 budget with 10,000 required savings and 20,000 of Food allotments.
  // Spend 18,000 and move the full 10,000 to savings: the expense headroom is
  // 2,000. Folding the target in reported 12,000 — money that had physically
  // left the spending accounts.
  const t = monthlyBudgetTotals({
    total: 30000,
    savingsTarget: 10000,
    categoryAllocated: 20000,
    spent: 18000,
  });
  assert.strictEqual(t.expenseBudget, 20000);
  assert.strictEqual(t.remaining, 2000);
  assert.strictEqual(t.allocated, 30000);
  assert.strictEqual(t.unallocated, 0);
  assert.strictEqual(t.overallPct, 90);
});

test("total = spent + remaining + savingsTarget", () => {
  const t = monthlyBudgetTotals({
    total: 30000,
    savingsTarget: 10000,
    categoryAllocated: 12000,
    spent: 7350.55,
  });
  assert.strictEqual(Math.round((7350.55 + t.remaining + 10000) * 100) / 100, 30000);
});

test("unbudgeted spending counts toward the month's percentage", () => {
  // 5,000 of Food budget inside a 30,000 month, 4,000 spent on Food and 12,000
  // in categories with no budget. Summing only the budgeted categories reported
  // 4,000 / 13% with a green bar while the vs-actual table said 16,000.
  const spent = 16000;
  const t = monthlyBudgetTotals({
    total: 30000,
    savingsTarget: 0,
    categoryAllocated: 5000,
    spent,
  });
  assert.strictEqual(t.expenseBudget, 30000);
  assert.strictEqual(t.remaining, 14000);
  assert.strictEqual(t.overallPct, 53.33);

  // And it agrees with what the vs-actual report prints for the same month.
  const r = report(
    [["c1", "Food", 5000]],
    [
      ["c1", "Food", 4000],
      ["c7", "Pets", 12000],
    ],
  );
  assert.strictEqual(r.totalActual, spent);
});

test("no monthly budget yields a zero percentage, not a division by zero", () => {
  const t = monthlyBudgetTotals({
    total: 0,
    savingsTarget: 0,
    categoryAllocated: 0,
    spent: 4200,
  });
  assert.strictEqual(t.expenseBudget, 0);
  assert.strictEqual(t.overallPct, 0);
  assertAllFinite(t, "totals");
});

test("a savings target larger than the total leaves no expense budget", () => {
  const t = monthlyBudgetTotals({
    total: 10000,
    savingsTarget: 15000,
    categoryAllocated: 2000,
    spent: 500,
  });
  assert.strictEqual(t.expenseBudget, 0);
  assert.strictEqual(t.unallocated, -7000);
  assert.strictEqual(t.overallPct, 0);
  assertAllFinite(t, "totals");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
