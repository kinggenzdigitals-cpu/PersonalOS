#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

for (const file of [".env.local", ".env"]) {
  const envPath = path.join(process.cwd(), file);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Auth identity audit needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function verifiedEmail(user) {
  return Boolean(user.email && user.email_confirmed_at);
}

function providers(user) {
  const fromApp = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];
  const fromIdentities = Array.isArray(user.identities)
    ? user.identities.map((identity) => identity.provider).filter(Boolean)
    : [];
  return Array.from(new Set([...fromApp, ...fromIdentities])).sort();
}

async function main() {
  const all = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    all.push(...(data.users ?? []));
    if (!data.nextPage) break;
  }

  const byEmail = new Map();
  for (const user of all) {
    const key = (user.email ?? "").trim().toLowerCase();
    if (!key) continue;
    const list = byEmail.get(key) ?? [];
    list.push(user);
    byEmail.set(key, list);
  }

  let duplicateGroups = 0;
  for (const [email, users] of byEmail) {
    if (users.length < 2) continue;
    duplicateGroups += 1;
    console.log(`duplicate email: ${email}`);
    for (const user of users) {
      console.log(
        `- user_id=${user.id} verified=${verifiedEmail(user)} providers=${providers(user).join(",") || "none"} created_at=${user.created_at}`,
      );
    }
    const allVerified = users.every(verifiedEmail);
    console.log(
      allVerified
        ? "  review: verified duplicate; use Supabase-supported identity linking or a deliberate data migration plan."
        : "  review: do not merge automatically because at least one email is unverified.",
    );
  }

  console.log(`users checked: ${all.length}`);
  console.log(`duplicate email groups: ${duplicateGroups}`);
}

main().catch((error) => {
  console.error(`Auth identity audit failed: ${error.message}`);
  process.exit(1);
});
