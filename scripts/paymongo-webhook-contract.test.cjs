"use strict";
/**
 * Structural checks on the PayMongo webhook route: that the safeguards exist
 * AND run in the right order.
 *
 * Comments are stripped first. The Xendit-era contract test passed even with
 * the signature check deleted, because its regex matched the route's own
 * docstring — so here, only executable code can satisfy an assertion.
 *
 * The pure pieces (signature, event parsing, references, the conflict rule)
 * have behavioural tests in their own suites; this file checks that the route
 * wires them together correctly.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = process.cwd();
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const code = stripComments(
  fs.readFileSync(path.join(root, "src/app/api/webhooks/paymongo/route.ts"), "utf8"),
);

function at(needle) {
  const i = code.indexOf(needle);
  assert.ok(i >= 0, `route must contain: ${needle}`);
  return i;
}
const count = (re) => (code.match(re) || []).length;

// 1. Raw body -> verify -> parse.
const rawRead = at("request.text()");
const verify = at("verifyPaymongoSignature(");
const parse = at("JSON.parse(");
assert.ok(rawRead < verify, "the raw body must be read before verification");
assert.ok(verify < parse, "the signature must be verified before the body is parsed");
assert.match(code, /status:\s*401/, "an invalid signature must be rejected with 401");

// 2. Amount -> already-settled -> activation -> PAID record.
const amount = at("amountMatches(");
const settled = at("await alreadySettled(admin");
const activation = at("await activate(admin");
const paidRecord = at("await record(admin, row)");
assert.ok(amount < settled, "the paid amount must be verified first");
assert.ok(settled < activation, "an already-settled session must be skipped before activating");
assert.ok(activation < paidRecord, "PAID (a counted sale) must be written only AFTER activation");
assert.match(code, /\.in\("status",\s*\[PAID,\s*NEEDS_REFUND\]\)/, "only a final outcome may count as settled");

// 3. Activation is one guarded row write that stamps the session id.
assert.ok(
  count(/xendit_customer_id:\s*sessionId/g) >= 3,
  "every activation (subscription, lifetime, promo) must stamp the session id in the same write",
);
assert.match(code, /xendit_customer_id\s*===\s*sessionId/, "a redelivery of an applied session must be recognised");
assert.ok(
  count(/\.eq\("updated_at",\s*updatedAt\)/g) >= 3,
  "every activation update must be a compare-and-swap on updated_at",
);
assert.ok(
  !/from\("subscriptions"\)\s*\.upsert\(/.test(code),
  "no unguarded upsert may write the subscriptions row",
);
assert.match(code, /activationConflict\(/, "a payment must not overwrite access the customer already holds");

// 4. A final row must exist before anything is acknowledged.
assert.ok(
  count(/if \(!\(await record\(admin,/g) >= 3,
  "a failed AMOUNT_MISMATCH, NEEDS_REFUND or PAID write must be retried, not acknowledged",
);
assert.ok(count(/status:\s*503/g) >= 2, "missing secret and missing service-role client must answer 503");
assert.match(code, /"23505"/, "unique violations must be recognised");

// 5. Other guards.
assert.match(code, /PROVIDER\s*=\s*"paymongo"/, "events must be recorded under the paymongo provider");
assert.match(code, /livemode\s*!==\s*paymongoLiveMode\(\)/, "test-mode events must not activate on a live deployment");
assert.match(code, /parseReference\(/, "the reference must be parsed strictly before use");

// 6. Only one billing system: the old provider's route is gone.
assert.ok(
  !fs.existsSync(path.join(root, "src/app/api/webhooks/xendit")),
  "the Xendit webhook route must be removed",
);

console.log("webhook contract checks passed");
