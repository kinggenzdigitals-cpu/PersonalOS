const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./load-typescript.cjs");
const { parseBalance, validComparison } = loadSource("src/lib/reconciliation.ts");
const input = () => ({
  accountId: "10000000-0000-4000-8000-000000000001",
  requestId: "10000000-0000-4000-8000-000000000002",
  asOf: new Date().toISOString(), recordedBalance: 1000, observedBalance: 950,
  difference: -50, applyAdjustment: false, notes: "",
});

test("balance validation accepts zero and negatives, rejects ambiguous input", () => {
  for (const [text, expected] of [["0", 0], ["-50.25", -50.25], [" 40000.50 ", 40000.5], ["9999999999.99", 9999999999.99]]) {
    assert.equal(parseBalance(text), expected);
  }
  for (const invalid of ["", "40,000", "1e3", "100abc", "1.234", "NaN", "Infinity", "10000000000"]) assert.equal(parseBalance(invalid), null);
  assert.equal(validComparison(input()), true);
  for (const invalid of [null, {}, { ...input(), notes: "x".repeat(241) }, { ...input(), asOf: "tomorrow" }, { ...input(), applyAdjustment: "true" }, { ...input(), observedBalance: 0.001 }]) assert.equal(validComparison(invalid), false);
});

function fixture({ signedIn = true, data = 1000, error = null } = {}) {
  const calls = [];
  let revalidated = false;
  const actions = loadSource("src/app/(app)/money/banking-actions.ts", {
    "next/cache": { revalidatePath() { revalidated = true; } },
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: signedIn ? { id: "owner" } : null } }) },
      rpc: async (...args) => { calls.push(args); return { data, error }; },
    }) },
  });
  return { actions, calls, wasRevalidated: () => revalidated };
}

test("reconciliation actions reject unauthenticated or invalid writes", async () => {
  const f = fixture({ signedIn: false });
  assert.equal((await f.actions.previewAccountBalance(input().accountId, 950)).ok, false);
  assert.equal((await f.actions.saveAccountComparison(input())).ok, false);
  assert.deepEqual(f.calls, []);
  const valid = fixture();
  assert.equal((await valid.actions.saveAccountComparison({ ...input(), applyAdjustment: true })).ok, false);
  assert.equal((await valid.actions.previewAccountBalance("not-an-account", 950)).ok, false);
  assert.deepEqual(valid.calls, []);
});

test("unavailable balances are never displayed as a successful zero", async () => {
  for (const options of [{ data: null }, { data: null, error: { message: "internal SQL" } }, { data: "NaN" }]) {
    const f = fixture(options);
    const result = await f.actions.previewAccountBalance(input().accountId, 950);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes("internal SQL"), false);
  }
  const result = await fixture({ data: 0 }).actions.previewAccountBalance(input().accountId, 0);
  assert.equal(result.ok, true);
  assert.equal(result.data.difference, 0);
});

test("saving sends explicit parameters; the database determines ownership and difference", async () => {
  const f = fixture({ data: { status: "needs_review" } });
  const value = { ...input(), user_id: "other", difference: 500000 };
  assert.equal((await f.actions.saveAccountComparison(value)).ok, true);
  assert.deepEqual(f.calls, [["record_account_reconciliation", {
    p_request_id: value.requestId, p_account_id: value.accountId, p_as_of: value.asOf,
    p_expected_balance: 1000, p_observed_balance: 950, p_apply_adjustment: false, p_notes: null,
  }]]);
  assert.equal(f.wasRevalidated(), true);
});

test("a changed or expired preview restarts comparison, other failures preserve retry", async () => {
  for (const message of ["Recorded balance changed. Compare again", "Preview expired. Compare again", "database detail"]) {
    const f = fixture({ data: null, error: { message } });
    const result = await f.actions.saveAccountComparison(input());
    assert.equal(result.ok, false);
    assert.equal(result.restart === true, message !== "database detail");
    assert.equal(result.error.includes("database detail"), false);
    assert.equal(f.wasRevalidated(), false);
  }
});

test("bank screen labels comparisons as manual and masks amounts with the privacy setting", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  let hidden = false;
  const { BankConnections } = loadSource("src/components/money/bank-connections.tsx", {
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/app/(app)/money/banking-actions": {},
    "@/lib/privacy-store": { subscribe: () => () => {}, getHidden: () => hidden, getServerHidden: () => hidden },
  });
  const props = {
    accounts: [{ id: input().accountId, name: "Test bank", type: "bank" }], available: true,
    currency: "PHP", timezone: "Asia/Manila",
    history: [{ id: "test", account_id: input().accountId, as_of: input().asOf,
      status: "needs_review", observed_balance: 54321.67, difference: -234.56 }],
  };
  const visible = renderToStaticMarkup(React.createElement(BankConnections, props));
  assert.match(visible, /54,321\.67/);
  assert.match(visible, /Manual comparison/);
  assert.match(visible, /Automatic bank sync is awaiting setup/);
  hidden = true;
  const masked = renderToStaticMarkup(React.createElement(BankConnections, props));
  assert.doesNotMatch(masked, /54,321\.67|234\.56/);
  assert.match(masked, /aria-label="Hidden"/);
  assert.match(masked, /id="observed-balance"[^>]*type="password"|type="password"[^>]*id="observed-balance"/);
});
