"use strict";
/**
 * Tests for PayMongo webhook signature verification. Compiled to .tmp-test by
 * "test:paymongo-signature", then run on bare node — no dependencies.
 *
 * The expected signatures are produced by an INDEPENDENT implementation of the
 * documented scheme (HMAC-SHA256 over `${t}.${rawBody}`), so these tests check
 * the module against the spec rather than against itself.
 */
const crypto = require("node:crypto");
const {
  parseSignatureHeader,
  computeSignature,
  verifyPaymongoSignature,
} = require("../.tmp-test/paymongo-signature.js");

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

const SECRET = "whsk_test_example_secret";
const T = "1757900000";
const BODY = JSON.stringify({
  data: { id: "evt_123", attributes: { type: "checkout_session.payment.paid", livemode: false } },
});
const spec = (t, body, secret) =>
  crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
const header = ({ t = T, te = "", li = "" } = {}) => `t=${t},te=${te},li=${li}`;
const verify = (over) =>
  verifyPaymongoSignature({ header: header(), rawBody: BODY, secret: SECRET, live: false, ...over });

const good = spec(T, BODY, SECRET);

// --- Matches the documented scheme ------------------------------------------
eq("computeSignature matches the documented scheme", computeSignature(T, BODY, SECRET), good);

// --- Mode separation --------------------------------------------------------
eq("valid test signature in test mode", verify({ header: header({ te: good }) }), true);
eq("test signature refused in live mode", verify({ header: header({ te: good }), live: true }), false);
eq("valid live signature in live mode", verify({ header: header({ li: good }), live: true }), true);
eq("live signature refused in test mode", verify({ header: header({ li: good }) }), false);

// --- Tampering --------------------------------------------------------------
eq("tampered body", verify({ header: header({ te: good }), rawBody: BODY.replace("paid", "fail") }), false);
eq(
  "re-serialised JSON (same data, different bytes) is refused",
  verify({ header: header({ te: good }), rawBody: JSON.stringify(JSON.parse(BODY), null, 2) }),
  false,
);
eq("wrong secret", verify({ header: header({ te: good }), secret: "some-other-secret" }), false);
eq("empty secret", verify({ header: header({ te: good }), secret: "" }), false);
eq(
  "signature over the body alone (timestamp omitted) is refused",
  verify({ header: header({ te: crypto.createHmac("sha256", SECRET).update(BODY).digest("hex") }) }),
  false,
);
eq("signature bound to a different timestamp", verify({ header: header({ t: "1757900001", te: good }) }), false);
eq("truncated signature", verify({ header: header({ te: good.slice(0, -2) }) }), false);
eq("non-hex signature", verify({ header: header({ te: `zz${good.slice(2)}` }) }), false);

// --- Tolerated formatting ---------------------------------------------------
eq("uppercase hex accepted", verify({ header: header({ te: good.toUpperCase() }) }), true);
eq("spaces around parts tolerated", verify({ header: `t=${T}, te=${good}, li=` }), true);

// --- Malformed headers ------------------------------------------------------
eq("missing header", verify({ header: null }), false);
eq("empty header", verify({ header: "" }), false);
eq("no timestamp", verify({ header: `te=${good},li=` }), false);
eq("non-numeric timestamp", verify({ header: `t=abc,te=${good},li=` }), false);
eq("parse returns all three parts", parseSignatureHeader(header({ te: "aa", li: "bb" })), { t: T, te: "aa", li: "bb" });
eq("parse rejects a header without t", parseSignatureHeader("te=aa,li=bb"), null);

console.log(`paymongo-signature: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
