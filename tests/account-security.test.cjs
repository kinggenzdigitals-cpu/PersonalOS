const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./load-typescript.cjs");
const { hasRecentAuthentication } = loadSource("src/lib/account-security.ts");
const NOW = 1_800_000_000_000;
const claims = (timestamp = NOW / 1000, method = "password") => ({
  sub: "owner", session_id: "current-session", amr: [{ method, timestamp }],
});

test("deletion requires recent authentication from the current verified session", () => {
  assert.equal(hasRecentAuthentication(claims(), "owner", NOW), true);
  assert.equal(hasRecentAuthentication(claims(NOW / 1000 - 900, "oauth"), "owner", NOW), true);
  for (const invalid of [null, {}, claims(NOW / 1000 - 901), claims(NOW / 1000 + 60), claims(NaN), claims(NOW / 1000, "token_refresh"), { ...claims(), session_id: "" }, { ...claims(), sub: "other" }]) {
    assert.equal(hasRecentAuthentication(invalid, "owner", NOW), false);
  }
  assert.equal(hasRecentAuthentication({ ...claims(NOW / 1000 - 901), iat: NOW / 1000 }, "owner", NOW), false);
});

function settingsFixture({ recent = true, signOutError = null, deleteError = null } = {}) {
  const calls = [];
  const supabase = { auth: {
    getUser: async () => ({ data: { user: { id: "owner", last_sign_in_at: new Date().toISOString() } } }),
    getClaims: async () => ({ data: { claims: claims(Date.now() / 1000 - (recent ? 1 : 3600)) }, error: null }),
    signOut: async (options) => { calls.push(["signOut", options]); return { error: signOutError }; },
  } };
  const actions = loadSource("src/app/(app)/settings/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/supabase/admin": { createAdminClient: () => ({ auth: { admin: {
      deleteUser: async (id) => { calls.push(["deleteUser", id]); return { error: deleteError }; },
    } } }) },
  });
  return { actions, calls };
}

test("a recent login elsewhere cannot authorize deletion from an old session", async () => {
  const { actions, calls } = settingsFixture({ recent: false });
  assert.equal((await actions.deleteAccount("DELETE ACCOUNT")).ok, false);
  assert.deepEqual(calls, []);
});

test("account deletion revokes sessions before deleting the authenticated user", async () => {
  const { actions, calls } = settingsFixture();
  assert.equal((await actions.deleteAccount("wrong confirmation")).ok, false);
  assert.deepEqual(calls, []);
  assert.equal((await actions.deleteAccount("DELETE ACCOUNT")).ok, true);
  assert.deepEqual(calls, [["signOut", { scope: "global" }], ["deleteUser", "owner"]]);
});

test("failed session revocation prevents account deletion", async () => {
  const { actions, calls } = settingsFixture({ signOutError: { message: "network" } });
  assert.equal((await actions.deleteAccount("DELETE ACCOUNT")).ok, false);
  assert.equal(calls.length, 1);
});

function exportFixture({ signedIn = true, failPage = false } = {}) {
  const events = [];
  const rangeCalls = [];
  const data = Array.from({ length: 1205 }, (_, id) => ({ id, user_id: "owner", description: `Row ${id}` }));
  const supabase = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "owner", email: "test@example.invalid" } : null } }) },
    rpc: async (...args) => { events.push(args); return { error: null }; },
    from(table) {
      let selected;
      return {
        select(columns, options) { selected = columns; assert.equal(options.count, "exact"); return this; },
        eq(column, value) { assert.equal(column, "user_id"); assert.equal(value, "owner"); return this; },
        order(column) { assert.equal(column, "id"); return this; },
        async range(from, to) {
          rangeCalls.push({ table, from, to });
          if (table === "feedback") assert.equal(selected.includes("admin_note"), false);
          if (table !== "transactions") return { data: [], count: 0, error: null };
          if (failPage && from > 0) return { data: null, count: null, error: { message: "private database details" } };
          // Also exercise a project whose API cap is below the requested 500.
          return { data: data.slice(from, Math.min(to + 1, from + 100)), count: data.length, error: null };
        },
      };
    },
  };
  return { events, rangeCalls, route: loadSource("src/app/api/account/export/route.ts", {
    "@/lib/supabase/server": { createClient: async () => supabase },
  }) };
}

test("export includes all 1205 records, even with a lower Data API row cap", async () => {
  const { route, events } = exportFixture();
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const payload = await response.json();
  assert.deepEqual(payload.data.account_reconciliations, []);
  assert.equal(payload.data.transactions.length, 1205);
  assert.equal(new Set(payload.data.transactions.map(row => row.id)).size, 1205);
  assert.equal(events.length, 1);
});

test("export rejects unauthenticated access and failed pages without a partial file", async () => {
  const anonymous = exportFixture({ signedIn: false });
  assert.equal((await anonymous.route.GET()).status, 401);
  assert.deepEqual(anonymous.rangeCalls, []);
  const failed = exportFixture({ failPage: true });
  const response = await failed.route.GET();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Content-Disposition"), null);
  assert.equal((await response.text()).includes("private database details"), false);
  assert.deepEqual(failed.events, []);
});

test("admin checks distinguish unavailable data from zero recorded errors", async () => {
  let guarded = false;
  const result = { data: null, count: null, error: { message: "missing table" } };
  const chain = new Proxy({}, { get: (_, key) => key === "then" ? Promise.resolve(result).then.bind(Promise.resolve(result)) : () => chain });
  const admin = loadSource("src/lib/admin/users.ts", {
    "server-only": {},
    "@/lib/entitlement": { requireSuperAdmin: async () => { guarded = true; } },
    "@/lib/supabase/admin": { createAdminClient: () => { assert.equal(guarded, true); return { from: () => chain }; } },
  });
  const health = await admin.getAdminSystemHealth();
  assert.equal(health.schemaVersion, null);
  assert.equal(health.pendingCheckouts, null);
  assert.equal(health.recentErrors, null);
  assert.equal(admin.summarize([
    { plan: "pro", accessType: "paid" },
    { plan: "premium", accessType: "paid" },
    { plan: "premium", accessType: "complimentary_pro" },
  ]).activePaid, 2);
});

test("owner-email admin access requires a verified email and ignores user metadata", async (t) => {
  const previous = process.env.SUPER_ADMIN_EMAIL;
  process.env.SUPER_ADMIN_EMAIL = "owner@example.invalid";
  t.after(() => {
    if (previous === undefined) delete process.env.SUPER_ADMIN_EMAIL;
    else process.env.SUPER_ADMIN_EMAIL = previous;
  });
  const user = { id: "owner", email: "owner@example.invalid", user_metadata: { role: "super_admin" } };
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null }) }),
  };
  const { getEntitlement } = loadSource("src/lib/entitlement.ts", {
    "server-only": {}, "next/navigation": { redirect() { throw new Error("redirect"); } },
    "@/lib/supabase/server": { createClient: async () => client },
  });
  assert.equal((await getEntitlement()).isSuperAdmin, false);
  user.email_confirmed_at = new Date().toISOString();
  assert.equal((await getEntitlement()).isSuperAdmin, true);
});
