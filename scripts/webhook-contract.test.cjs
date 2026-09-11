const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const route = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/webhooks/xendit/route.ts"),
  "utf8",
);

assert.match(route, /XENDIT_WEBHOOK_TOKEN/, "webhook must verify the configured callback token");
assert.match(route, /billing_events/, "webhook must record billing events for idempotency/audit history");
assert.match(route, /event_id/, "webhook must use provider event IDs to reject duplicates");
assert.match(route, /SUPABASE_SERVICE_ROLE_KEY|adminClient|createAdminClient/, "webhook must require a service-role client");
assert.match(route, /promo|promo_redemptions/, "webhook must handle promo checkout activation");

console.log("webhook contract checks passed");
