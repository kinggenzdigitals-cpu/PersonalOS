"use strict";
/**
 * Tests for PayMongo event parsing and the paid-amount check. Compiled to
 * .tmp-test by "test:paymongo-event", then run on bare node — no dependencies.
 * Payloads follow the documented envelope: data.attributes.{type, livemode,
 * data: <checkout session>}.
 */
const E = require("../.tmp-test/paymongo-event.js");

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

const pay = (amount, status = "paid", currency = "PHP", id = "pay_1") => ({
  id,
  type: "payment",
  attributes: { amount, currency, status, fee: 1250 },
});

// `null` (not undefined) switches a field off — undefined would hit the default.
function event({
  type = "checkout_session.payment.paid",
  livemode = false,
  reference = "sub_ref",
  expected = "499900",
  payments = [pay(499900)],
} = {}) {
  return {
    data: {
      id: "evt_abc123",
      type: "event",
      attributes: {
        type,
        livemode,
        created_at: 1757900000,
        updated_at: 1757900000,
        data: {
          id: "cs_xyz789",
          type: "checkout_session",
          attributes: {
            reference_number: reference,
            metadata: expected === null ? {} : { kind: "lifetime", expected_centavos: expected },
            payments,
          },
        },
      },
    },
  };
}
const read = (over) => E.readPaidCheckout(event(over));

// --- Event type -------------------------------------------------------------
eq("event type is read", E.eventType(event()), "checkout_session.payment.paid");
eq("another event type", E.eventType(event({ type: "payment.failed" })), "payment.failed");
eq("event type of a string body", E.eventType("nope"), null);
eq("event type of null", E.eventType(null), null);

// --- Fields -----------------------------------------------------------------
eq("fields are extracted", read(), {
  eventId: "evt_abc123",
  sessionId: "cs_xyz789",
  livemode: false,
  reference: "sub_ref",
  expectedCentavos: 499900,
  paidCentavos: 499900,
  currencyOk: true,
  paymentId: "pay_1",
});
eq("livemode true", read({ livemode: true }).livemode, true);
eq("non-boolean livemode is treated as test", read({ livemode: "true" }).livemode, false);

// --- The amount check -------------------------------------------------------
check("exact amount in PHP passes", E.amountMatches(read()));
check("split payments summing to the charge pass", E.amountMatches(read({ payments: [pay(400000), pay(99900, "paid", "PHP", "pay_2")] })));
check("underpaid is refused", !E.amountMatches(read({ payments: [pay(100)] })));
check("overpaid is refused", !E.amountMatches(read({ payments: [pay(999999)] })));
check("wrong currency is refused", !E.amountMatches(read({ payments: [pay(499900, "paid", "USD")] })));
check("missing expected amount is refused", !E.amountMatches(read({ expected: null })));
check("non-integer expected amount is refused", !E.amountMatches(read({ expected: "4999.00" })));
check("no payments is refused", !E.amountMatches(read({ payments: [] })));
check("only a failed payment is refused", !E.amountMatches(read({ payments: [pay(499900, "failed")] })));
eq(
  "unpaid payments are not counted",
  read({ payments: [pay(499900), pay(499900, "failed", "PHP", "pay_2")] }).paidCentavos,
  499900,
);
eq("payments that aren't an array count as nothing paid", read({ payments: "oops" }).paidCentavos, 0);

// --- Malformed payloads -----------------------------------------------------
eq("fractional centavos rejects the event", read({ payments: [pay(4999.5)] }), null);
eq("negative amount rejects the event", read({ payments: [pay(-1)] }), null);
eq("missing reference", read({ reference: null }), null);
eq("null body", E.readPaidCheckout(null), null);
eq("string body", E.readPaidCheckout("x"), null);
eq("event without a session", E.readPaidCheckout({ data: { id: "evt_1", attributes: { type: "x" } } }), null);

console.log(`paymongo-event: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
