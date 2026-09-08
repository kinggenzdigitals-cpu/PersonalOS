/**
 * Tests for the /auth/v1/settings provider parser.
 *
 * The bug worth guarding: a rejected or unauthorised request to that endpoint
 * still answers with valid JSON — it just has no `external` key. The obvious
 * `body.external?.google` then yields undefined, which is falsy, which reads as
 * "the provider is off". A rotated key would therefore hide the Google button
 * permanently, and switching the provider on in the dashboard would never bring
 * it back, because nothing would ever be observed as enabled again. Everything
 * below is about keeping "off" and "couldn't ask" apart.
 */
const assert = require("assert");
const { parseProviderState } = require("../.tmp-test/auth-provider-state.js");

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

// ---- the answers Supabase actually gives ----------------------------------

test("a real boolean is the only thing treated as an answer", () => {
  assert.strictEqual(parseProviderState({ external: { google: true } }, "google"), "enabled");
  assert.strictEqual(parseProviderState({ external: { google: false } }, "google"), "disabled");
});

test("other providers in the same body do not leak into the answer", () => {
  const body = { external: { google: false, github: true, apple: true } };
  assert.strictEqual(parseProviderState(body, "google"), "disabled");
  assert.strictEqual(parseProviderState(body, "github"), "enabled");
});

test("a full settings body parses like the trimmed one", () => {
  // Shape of the live response, abridged.
  const body = {
    external: { anonymous_users: false, email: true, google: false, phone: false },
    disable_signup: false,
    mailer_autoconfirm: false,
    saml_enabled: false,
  };
  assert.strictEqual(parseProviderState(body, "google"), "disabled");
});

// ---- the regression this file exists for ----------------------------------

test("an error body with no `external` key is unknown, never disabled", () => {
  // What a 401 from a rotated key looks like: valid JSON, no provider list.
  const rejected = { hint: "Double check your Supabase `anon` or `service_role` API key.", message: "Invalid API key" };
  assert.strictEqual(parseProviderState(rejected, "google"), "unknown");
});

test("a provider missing from an otherwise valid list is unknown", () => {
  assert.strictEqual(parseProviderState({ external: { email: true } }, "google"), "unknown");
});

test("a non-boolean value is unknown, however truthy or falsy it looks", () => {
  for (const value of ["true", "false", "", 0, 1, null, undefined, {}, []]) {
    assert.strictEqual(
      parseProviderState({ external: { google: value } }, "google"),
      "unknown",
      `not unknown for: ${JSON.stringify(value)}`,
    );
  }
});

test("an inherited property cannot pass itself off as an answer", () => {
  // Object.create puts `google` on the prototype, where `in` and plain member
  // access would both find it. Only an own property counts as Supabase having
  // answered, so `constructor`/`toString` and friends cannot either.
  const external = Object.create({ google: true });
  assert.strictEqual(parseProviderState({ external }, "google"), "unknown");
  assert.strictEqual(parseProviderState({ external: {} }, "constructor"), "unknown");
  assert.strictEqual(parseProviderState({ external: {} }, "toString"), "unknown");
});

// ---- nothing at all is still an answer of "we don't know" -----------------

test("junk bodies are unknown rather than a throw", () => {
  for (const body of [null, undefined, "", "not json", 42, [], {}, { external: null }, { external: "google" }, { external: 7 }]) {
    assert.strictEqual(
      parseProviderState(body, "google"),
      "unknown",
      `not unknown for: ${JSON.stringify(body)}`,
    );
  }
});

console.log(`auth-provider-state: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
