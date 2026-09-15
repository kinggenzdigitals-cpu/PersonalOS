#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

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

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYMONGO_SECRET_KEY",
  "PAYMONGO_WEBHOOK_SECRET",
];

function looksLikePlaceholder(value) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized.startsWith("your-") ||
    normalized.includes("your-project-ref") ||
    normalized.includes("placeholder") ||
    normalized === "test" ||
    normalized === "changeme"
  );
}
const allowPlaceholder = process.env.ALLOW_PLACEHOLDER_ENV === "1";
const missing = [];

for (const key of required) {
  const value = process.env[key];
  if (!value || (!allowPlaceholder && looksLikePlaceholder(value))) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  console.error("Launch preflight failed. Configure these production variables:");
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

if ((process.env.PAYMONGO_SECRET_KEY || "").startsWith("sk_test_")) {
  console.warn("Warning: PAYMONGO_SECRET_KEY is a TEST key (sk_test_). Real payments need an sk_live_ key.");
}

console.log("Launch preflight passed: required production variables are present.");
