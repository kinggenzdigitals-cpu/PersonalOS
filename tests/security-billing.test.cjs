const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./load-typescript.cjs");

const billing = loadSource("src/lib/billing-security.ts");
const plans = loadSource("src/lib/plans.ts");

test("runtime billing input accepts only supported plans and periods", () => {
  assert.equal(billing.isPaidPlan("pro"), true);
  assert.equal(billing.isPaidPlan("premium"), true);
  assert.equal(billing.isPaidPlan("free"), false);
  assert.equal(billing.isBillingPeriod("quarterly"), true);
  assert.equal(billing.isBillingPeriod("yearly"), false);
});

test("billing periods map to the expected month count", () => {
  assert.equal(billing.periodMonths("monthly"), 1);
  assert.equal(billing.periodMonths("quarterly"), 3);
  assert.equal(billing.periodMonths("semiannual"), 6);
  assert.equal(billing.periodMonths("annual"), 12);
});

test("displayed totals and savings agree with monthly pricing", () => {
  for (const plan of ["pro", "premium"]) {
    const monthly = plans.PLAN_PRICES[plan].monthly.total;
    for (const period of plans.BILLING_PERIODS) {
      const price = plans.PLAN_PRICES[plan][period.id];
      assert.equal(price.total, billing.checkoutAmount(plan, period.id));
      assert.equal(price.save, monthly * period.months - price.total);
    }
  }
});

test("paid callback parsing requires provider invoice, amount, PHP, and new checkout ID", () => {
  assert.deepEqual(
    billing.parsePaidCallback({
      status: "PAID",
      external_id: "fht_123",
      id: "inv_123",
      paid_amount: "129",
      currency: "PHP",
      paid_at: "2026-09-07T12:00:00.000Z",
    }),
    {
      externalId: "fht_123",
      invoiceId: "inv_123",
      amount: 129,
      currency: "PHP",
      paidAt: "2026-09-07T12:00:00.000Z",
    },
  );

  assert.equal(
    billing.parsePaidCallback({
      status: "PAID",
      external_id: "sub_user_pro_monthly_1",
      id: "inv_123",
      amount: 129,
      currency: "PHP",
    }),
    null,
  );
  assert.equal(
    billing.parsePaidCallback({
      status: "PAID",
      external_id: "fht_123",
      id: "inv_123",
      amount: 129,
      currency: "USD",
    }),
    null,
  );
  assert.equal(billing.parsePaidCallback({ status: "PENDING" }), null);
});
