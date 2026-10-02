"use strict";
/**
 * Tests for the signed undo token behind Undo on a deleted transaction.
 * Compiled to .tmp-test by the "test:undo-token" script, then run on bare
 * node — no dependencies. The key and the clock are injected, so expiry and
 * key rotation are ordinary arguments here rather than wall-clock waits.
 */
const {
  deriveUndoKey,
  signUndoToken,
  verifyUndoToken,
  UNDO_TOKEN_TTL_MS,
} = require("../.tmp-test/undo-token.js");

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
function ok(label, actual) {
  eq(label, Boolean(actual), true);
}

const USER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const KEY = deriveUndoKey("service-role-key");
const NOW = 1_700_000_000_000;

const ROW = {
  id: "33333333-3333-3333-3333-333333333333",
  user_id: USER,
  type: "expense",
  amount: 250.5,
  category_id: "44444444-4444-4444-4444-444444444444",
  account_id: "55555555-5555-5555-5555-555555555555",
  to_account_id: null,
  direction: null,
  occurred_at: "2026-01-04T09:30:00.000Z",
  merchant: "Jollibee",
  notes: null,
  // An earlier month than "now": the case the cap used to refuse.
  created_at: "2025-11-02T02:15:00.000Z",
};

const token = signUndoToken(ROW, { key: KEY, now: NOW });
const verify = (t, opts) =>
  verifyUndoToken(t, { key: KEY, now: NOW, userId: USER, ...opts });

// --- A fresh token round-trips the row unchanged -----------------------------
eq("round-trips every field, id and created_at included", verify(token), ROW);
eq("token is opaque: no field is readable in it", /Jollibee/.test(token), false);

// --- The key never leaves the server, and is not the secret itself -----------
eq("derived key is a sha256 hex digest", /^[0-9a-f]{64}$/.test(KEY), true);
eq(
  "derivation does not expose the secret",
  KEY.includes("service-role-key"),
  false,
);
eq("same secret derives the same key", deriveUndoKey("service-role-key"), KEY);
eq("a different secret derives a different key", deriveUndoKey("other") === KEY, false);
eq("no secret means no key", deriveUndoKey(undefined), "");

// --- Tampering ---------------------------------------------------------------
const body = token.slice(0, token.indexOf("."));
const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
function retampered(mutate) {
  const copy = JSON.parse(JSON.stringify(payload));
  mutate(copy);
  const forged = Buffer.from(JSON.stringify(copy), "utf8").toString("base64url");
  return `${forged}.${token.slice(token.indexOf(".") + 1)}`;
}
eq("edited amount is refused", verify(retampered((p) => (p.row.amount = 99999))), null);
eq(
  "edited account is refused",
  verify(retampered((p) => (p.row.account_id = "66666666-6666-6666-6666-666666666666"))),
  null,
);
eq("stolen row re-pointed at another user is refused", verify(retampered((p) => (p.row.user_id = OTHER))), null);
eq("extended expiry is refused", verify(retampered((p) => (p.exp = NOW + 10 * UNDO_TOKEN_TTL_MS))), null);
eq("flipped signature is refused", verify(`${body}.${"0".repeat(64)}`), null);
eq("truncated signature is refused", verify(`${body}.`), null);
eq("body without a signature is refused", verify(body), null);
eq("empty token is refused", verify(""), null);
eq("missing token is refused", verify(undefined), null);
eq("garbage is refused", verify("not-a-token"), null);

// --- Wrong user --------------------------------------------------------------
eq("another user cannot spend this token", verify(token, { userId: OTHER }), null);
eq("an unknown user is refused", verify(token, { userId: "" }), null);
ok("the signing user still can", verify(token, { userId: USER }));

// --- Expiry ------------------------------------------------------------------
ok("valid just before expiry", verify(token, { now: NOW + UNDO_TOKEN_TTL_MS - 1 }));
eq("refused at the expiry instant", verify(token, { now: NOW + UNDO_TOKEN_TTL_MS }), null);
eq("refused long after", verify(token, { now: NOW + 24 * 60 * 60 * 1000 }), null);
eq(
  "a short ttl expires early",
  verify(signUndoToken(ROW, { key: KEY, now: NOW, ttlMs: 1000 }), {
    now: NOW + 2000,
  }),
  null,
);
eq(
  "the window outlasts the undo toast",
  UNDO_TOKEN_TTL_MS >= 10 * 60 * 1000,
  true,
);

// --- Wrong key ---------------------------------------------------------------
eq(
  "a token signed with another key is refused",
  verify(signUndoToken(ROW, { key: deriveUndoKey("rotated-key"), now: NOW })),
  null,
);
eq(
  "the same token under a rotated key is refused",
  verifyUndoToken(token, {
    key: deriveUndoKey("rotated-key"),
    now: NOW,
    userId: USER,
  }),
  null,
);
eq(
  "an unconfigured key verifies nothing",
  verifyUndoToken(token, { key: "", now: NOW, userId: USER }),
  null,
);

console.log(`undo-token: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
