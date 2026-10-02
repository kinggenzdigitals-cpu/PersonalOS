"use strict";
/**
 * Device-limit contract, read from the source:
 *
 *  1. a removed (revoked) device is never brought back: registerCurrentDevice
 *     signs that browser out BEFORE the free-slot check, and the upsert can't
 *     clear revoked_at;
 *  2. removeDevice leaves the device cookie alone, so the caller's own browser
 *     is signed out by the same path instead of re-registering as "new";
 *  3. every branch where the limit fails open logs that it did;
 *  4. a fresh sign-in on a removed browser counts as a new device: recordLogin,
 *     which every sign-in path reaches, drops a revoked device cookie (and only
 *     a revoked one), so the first sign-in isn't bounced back to /login.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p) => stripTs(fs.readFileSync(path.join(ROOT, p), "utf8"));

const devices = read("src/lib/devices.ts");
const fnBody = (name) => {
  const start = devices.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = devices.indexOf("\nexport ", start + 1);
  return devices.slice(start, next === -1 ? undefined : next);
};

// 1. Revoked stays revoked.
const register = fnBody("registerCurrentDevice");
const revokedAt = register.search(/if\s*\(\s*existing\?\.revoked_at\s*\)\s*\{/);
const countAt = register.search(/count:\s*"exact"/);
assert.ok(revokedAt > 0, "registerCurrentDevice must branch on a revoked existing row");
assert.ok(countAt > 0 && revokedAt < countAt, "the revoked branch must run before the free-slot count");
const branchEnd = register.slice(revokedAt).search(/\n\s*\}\s*\n/);
const revokedBranch = register.slice(revokedAt, revokedAt + branchEnd);
assert.match(revokedBranch, /supabase\.auth\.signOut\(\s*\{\s*scope:\s*"local"\s*\}\s*\)/, "a revoked device must be signed out (local scope)");
assert.match(revokedBranch, /jar\.delete\(DEVICE_COOKIE\)/, "the revoked token must be dropped so a fresh sign-in isn't locked out");
assert.match(revokedBranch, /redirect\("\/login/, "a revoked device must land on /login");
assert.ok(!/revoked_at:\s*null/.test(devices), "nothing in devices.ts may un-revoke a device");

// 2. removeDevice doesn't hand the current browser a clean slate.
const actions = read("src/app/(app)/account/device-actions.ts");
assert.ok(!/DEVICE_COOKIE/.test(actions), "removeDevice must not touch the device cookie");
assert.match(actions, /revoked_at:\s*new Date\(\)\.toISOString\(\)/, "removeDevice still revokes the row");

// 3. Fail-open branches are visible.
const enforce = fnBody("enforceCurrentDevice");
for (const [label, body] of [["enforceCurrentDevice", enforce], ["registerCurrentDevice", register]]) {
  assert.match(body, /catch\s*\{\s*logLimitSkipped\(/, `${label}: a missing service-role client must be logged`);
  assert.match(body, /isSchemaMissing\([a-zA-Z]+\)\)\s*\{\s*logLimitSkipped\(/, `${label}: a missing table must be logged`);
  assert.match(body, /if\s*\(countError\)\s*logLimitSkipped\(/, `${label}: a failed count must be logged`);
}
assert.match(devices, /function logLimitSkipped\([^)]*\)\s*\{\s*console\.error\(/, "logLimitSkipped must write to console.error");

// 4. A fresh sign-in on a removed browser registers as a new device.
const forget = fnBody("forgetRevokedDeviceCookie");
assert.match(forget, /if\s*\(!currentHash\)\s*return;/, "a browser with no device cookie has nothing to forget");
assert.match(forget, /createAdminClient\(\)/, "the revoked lookup must use the admin client");
assert.match(forget, /\.eq\("user_id",\s*userId\)/, "the lookup must be scoped to the signed-in user");
assert.match(forget, /\.eq\("device_token_hash",\s*currentHash\)/, "the lookup must use this browser's token hash");
assert.match(forget, /if\s*\(\s*data\?\.revoked_at\s*\)\s*\(await cookies\(\)\)\.delete\(DEVICE_COOKIE\)/, "only a revoked token may be dropped");
assert.ok(!/signOut|redirect\(/.test(forget), "a fresh sign-in must not be signed out or redirected here");

const recordLoginSrc = read("src/app/auth/actions.ts");
assert.match(recordLoginSrc, /forgetRevokedDeviceCookie\(user\.id\)/, "recordLogin must drop a revoked device cookie");

const callsAfter = (file, signIn) => {
  const src = read(file);
  const at = src.search(signIn);
  assert.ok(at >= 0, `${file}: sign-in call not found`);
  assert.ok(src.indexOf("recordLogin()", at) > at, `${file}: recordLogin() must run after a successful sign-in`);
};
callsAfter("src/components/auth/auth-form.tsx", /signInWithPassword\(/);
callsAfter("src/app/auth/callback/route.ts", /exchangeCodeForSession\(/);
callsAfter("src/app/auth/callback/route.ts", /verifyOtp\(/);
callsAfter("src/app/(auth)/forgot-password/page.tsx", /updateUser\(\{\s*password\s*\}\)/);

console.log("devices contract checks passed");
