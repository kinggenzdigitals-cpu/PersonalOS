const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const migrations = fs
  .readdirSync(path.join(process.cwd(), "supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => fs.readFileSync(path.join(process.cwd(), "supabase/migrations", file), "utf8"))
  .join("\n");

for (const table of [
  "accounts",
  "transactions",
  "habits",
  "tasks",
  "calendar_events",
  "focus_sessions",
  "user_preferences",
  "task_projects",
  "task_comments",
]) {
  assert.match(
    migrations,
    new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    `${table} must have RLS enabled`,
  );
}

assert.match(migrations, /auth\.uid\(\)\s*=\s*user_id/i, "owner-scoped RLS policies must compare auth.uid() to user_id");
console.log("RLS contract checks passed");
