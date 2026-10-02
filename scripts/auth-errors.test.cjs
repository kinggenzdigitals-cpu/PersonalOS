/**
 * Tests for the auth error copy mapping.
 *
 * These exist because of a real incident: password reset was failing with a
 * Supabase 500 "Error sending recovery email", but the network catch-all ran
 * first and matched the bare substring "fetch", relabelling it "temporarily
 * unavailable". That told the user to wait, when waiting could never help and
 * the real fault was mail configuration. Ordering is the thing under test.
 */
const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const {
  friendlyAuthError,
  isBannedAuthError,
  ACCOUNT_SUSPENDED_MESSAGE,
} = require("../.tmp-test/auth-errors.js");

const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

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

const TRANSIENT = "Our service is temporarily unavailable. Please try again in a moment.";

// ---- the regression this file exists for ----------------------------------

test("a mail-provider failure is NOT reported as a transient outage", () => {
  const out = friendlyAuthError("Error sending recovery email");
  assert.notStrictEqual(out, TRANSIENT);
  assert.match(out, /mail service rejected it/);
});

test("mail failures are identified however they are worded", () => {
  for (const raw of [
    "Error sending recovery email",
    "Error sending confirmation email",
    "smtp: could not connect",
    "Failed to send email",
  ]) {
    assert.match(
      friendlyAuthError(raw),
      /mail service rejected it/,
      `not matched: ${raw}`,
    );
  }
});

test("an identifiable error containing the word 'fetch' is not swallowed", () => {
  // The old catch-all matched a bare "fetch" anywhere in the message.
  const out = friendlyAuthError("Error sending recovery email (could not fetch template)");
  assert.notStrictEqual(out, TRANSIENT);
});

// ---- genuine transport failures still map to the calm message -------------

test("a real browser network failure is transient", () => {
  assert.strictEqual(friendlyAuthError("Failed to fetch"), TRANSIENT);
  assert.strictEqual(friendlyAuthError("NetworkError when attempting to fetch"), TRANSIENT);
  assert.strictEqual(friendlyAuthError("Load failed"), TRANSIENT);
  assert.strictEqual(friendlyAuthError("502 Bad Gateway"), TRANSIENT);
});

test("an empty or unreadable error is transient rather than parroted", () => {
  assert.strictEqual(friendlyAuthError(""), TRANSIENT);
  assert.strictEqual(friendlyAuthError(null), TRANSIENT);
  assert.strictEqual(friendlyAuthError(undefined), TRANSIENT);
  assert.strictEqual(friendlyAuthError("{}"), TRANSIENT);
  assert.strictEqual(friendlyAuthError("[object Object]"), TRANSIENT);
});

// ---- sign-in ---------------------------------------------------------------

test("bad credentials", () => {
  const out = friendlyAuthError("Invalid login credentials");
  assert.match(out, /doesn't match/);
  assert.match(out, /Continue with Google/);
});

test("unconfirmed email", () => {
  assert.match(friendlyAuthError("Email not confirmed"), /confirm your email/i);
});

test("duplicate signup", () => {
  assert.match(
    friendlyAuthError("User already registered"),
    /already exists/,
  );
});

// ---- a suspended account ---------------------------------------------------
// Suspending or revoking bans the account in GoTrue, so sign-in now fails with
// "User is banned" and /suspended — the page carrying the support address — is
// out of reach. Parroting the ban would leave the holder no way to appeal.

test("a banned account is told it is suspended, with a way to appeal", () => {
  const out = friendlyAuthError("User is banned");
  assert.match(out, /suspended/i);
  assert.match(out, /contact support at \S+@\S+/);
});

test("the ban is recognised however GoTrue words it", () => {
  for (const raw of ["User is banned", "user_banned", "USER IS BANNED"]) {
    assert.strictEqual(friendlyAuthError(raw), ACCOUNT_SUSPENDED_MESSAGE, raw);
  }
});

test("isBannedAuthError reads the callback's error_code and error_description", () => {
  assert.ok(isBannedAuthError("user_banned", null));
  assert.ok(isBannedAuthError(null, "User is banned"));
  assert.ok(!isBannedAuthError("otp_expired", "Email link is invalid or has expired"));
  assert.ok(!isBannedAuthError(null, undefined));
});

test("the suspension copy reuses the /suspended page's support address", () => {
  const address = ACCOUNT_SUSPENDED_MESSAGE.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  assert.ok(address, "the suspension copy must name a support address");
  assert.ok(
    read("src/app/suspended/page.tsx").includes(address[0]),
    `/suspended does not publish ${address[0]}`,
  );
});

test("the Google / email-link path shows the same suspension copy", () => {
  assert.match(
    read("src/app/auth/callback/route.ts"),
    /isBannedAuthError\(/,
    "the auth callback must recognise a ban instead of reporting an expired link",
  );
  assert.match(
    read("src/app/auth/auth-code-error/page.tsx"),
    /ACCOUNT_SUSPENDED_MESSAGE/,
    "the page the callback redirects to must show the same copy",
  );
});

test("rate limiting asks the user to wait", () => {
  assert.match(friendlyAuthError("Email rate limit exceeded"), /Too many attempts/);
  assert.match(friendlyAuthError("Too many requests"), /Too many attempts/);
});

// ---- recovery codes and passwords -----------------------------------------

test("an expired code says so", () => {
  assert.match(friendlyAuthError("Token has expired"), /expired/);
  assert.match(friendlyAuthError("otp_expired"), /expired/);
  assert.match(
    friendlyAuthError("Email link is invalid or has expired"),
    /expired/,
  );
});

test("a wrong code says so", () => {
  assert.match(friendlyAuthError("Invalid token"), /isn't right/);
});

test("reusing the current password", () => {
  assert.match(
    friendlyAuthError("New password should be different from the old password"),
    /current password/,
  );
});

test("a weak password", () => {
  assert.match(
    friendlyAuthError("Password should be at least 8 characters"),
    /stronger password/,
  );
});

// ---- fallthrough -----------------------------------------------------------

test("an unrecognised but readable error is passed through", () => {
  const raw = "Something highly specific went sideways";
  assert.strictEqual(friendlyAuthError(raw), raw);
});

test("matching is case-insensitive", () => {
  assert.match(friendlyAuthError("ERROR SENDING RECOVERY EMAIL"), /mail service/);
  assert.match(friendlyAuthError("invalid LOGIN credentials"), /Continue with Google/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
