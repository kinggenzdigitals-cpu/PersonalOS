import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Isolated PostgreSQL engine. Only the Supabase auth service and grants are
// represented here; no live project, network call, or real user data is used.
let db;
const owner="10000000-0000-4000-8000-000000000001";
const other="10000000-0000-4000-8000-000000000002";
let category, goal;
const sql = async name => readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8");
const asUser = async id => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec("set role authenticated");
};
before(async () => {
  db=new PGlite();
  await db.exec(`create role authenticated; create role anon; create role service_role bypassrls; create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  // pgcrypto itself is not bundled. gen_random_uuid() is native PostgreSQL.
  await db.exec((await sql("0001_init.sql")).replace("create extension if not exists pgcrypto;", ""));
  await db.exec(await sql("0002_rls.sql"));
  await db.exec(await sql("0003_ledger.sql"));
  await db.exec(await sql("0004_networth.sql"));
  await db.exec(await sql("0005_savings_goals.sql"));
  await db.exec(await sql("0006_subscriptions.sql"));
  await db.exec(await sql("0007_focus_sessions.sql"));
  await db.exec(await sql("0008_admin_feedback.sql"));
  await db.exec(await sql("0009_invitations.sql"));
  await db.exec(await sql("0010_promotions.sql"));
  await db.exec("grant select,insert,update,delete on all tables in schema public to authenticated");
  await db.query("insert into auth.users(id) values ($1),($2)",[owner,other]);
  category=(await db.query("select id from categories where user_id=$1 and name='Food'",[owner])).rows[0].id;
  await db.query("insert into budgets(user_id,category_id,amount) values ($1,$2,40000)",[owner,category]);
  goal=(await db.query("insert into savings_goals(user_id,name,target_amount,saved_amount) values ($1,'Car',10000,3000) returning id",[owner])).rows[0].id;
  await db.exec(await sql("0011_monthly_budget_planner.sql"));
  await db.exec(await sql("0012_security_and_billing.sql"));
  await db.exec(await sql("20260907152123_security_admin_hardening.sql"));
});
after(async () => {await db?.close();});

test("migration keeps legacy budgets writable and copies existing balances", async () => {
  await asUser(owner);
  assert.equal((await db.query("select amount from monthly_category_budgets")).rows[0].amount,"40000.00");
  assert.equal((await db.query("select total_budget from monthly_budget_plans")).rows[0].total_budget,"40000.00");
  assert.equal((await db.query("select saved_amount from savings_goals")).rows[0].saved_amount,"3000.00");
  await db.query("insert into budgets(user_id,category_id,amount) values ($1,$2,42000) on conflict(user_id,category_id) do update set amount=excluded.amount",[owner,category]);
  assert.equal((await db.query("select amount from budgets")).rows[0].amount,"42000.00");
});
test("new month creates a distinct allotment without changing the old month", async () => {
  await asUser(owner);
  await db.query("insert into monthly_category_budgets(user_id,category_id,month_start,amount) values ($1,$2,'2090-02-01',5000)",[owner,category]);
  assert.equal((await db.query("select count(*)::int as n from monthly_category_budgets")).rows[0].n,2);
  await assert.rejects(db.query("insert into monthly_category_budgets(user_id,category_id,month_start,amount) values ($1,$2,'2090-02-02',5000)",[owner,category]), /check constraint/);
});
test("RLS hides other users and rejects cross-owner links", async () => {
  await asUser(other);
  for (const table of ["monthly_budget_plans","monthly_category_budgets","monthly_goal_allocations","savings_goal_contributions"]) {
    assert.equal((await db.query(`select count(*)::int as n from ${table}`)).rows[0].n,0);
  }
  await assert.rejects(db.query("insert into monthly_budget_plans(user_id,month_start,total_budget) values ($1,'2090-02-01',100)",[owner]),/row-level security/);
  await assert.rejects(db.query("insert into monthly_goal_allocations(user_id,goal_id,month_start,amount) values ($1,$2,'2090-02-01',100)",[other,goal]),/foreign key/);
  await assert.rejects(db.query("insert into monthly_category_budgets(user_id,category_id,month_start,amount) values ($1,$2,'2090-02-01',100)",[other,category]),/foreign key/);
  await assert.rejects(db.query("select contribute_to_savings_goal($1,100)",[goal]),/not found/);
});
test("contribution updates balance and history atomically, rejecting invalid values", async () => {
  await asUser(owner);
  await db.query("select contribute_to_savings_goal($1,500)",[goal]);
  assert.equal((await db.query("select saved_amount from savings_goals")).rows[0].saved_amount,"3500.00");
  assert.equal((await db.query("select sum(amount) as total from savings_goal_contributions")).rows[0].total,"500.00");
  for (const amount of ["-1","0","NaN"]) await assert.rejects(db.query("select contribute_to_savings_goal($1,$2::numeric)",[goal,amount]),/greater than zero/);
  await assert.rejects(db.query("select contribute_to_savings_goal($1,100,now()+interval '1 day')",[goal]),/future/);
  assert.equal((await db.query("select saved_amount from savings_goals")).rows[0].saved_amount,"3500.00");
});
test("anonymous calls cannot contribute or read private plans", async () => {
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("select contribute_to_savings_goal($1,100)",[goal]),/permission denied/);
  await assert.rejects(db.query("select * from monthly_budget_plans"),/permission denied/);
});

test("starter writes roll back together on a bad savings goal", async () => {
  await asUser(owner);
  await assert.rejects(db.query("select initialize_monthly_budget('2091-01-01',1000,1000,true,$1::jsonb,$2::jsonb)",[
    JSON.stringify([{category_id:category,amount:700}]),
    JSON.stringify([{goal_id:'ffffffff-ffff-4fff-8fff-ffffffffffff',amount:300}]),
  ]),/foreign key/);
  assert.equal((await db.query("select count(*)::int as n from monthly_budget_plans where month_start='2091-01-01'")).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int as n from monthly_category_budgets where month_start='2091-01-01'")).rows[0].n,0);
});
test("starter succeeds once; retry cannot overwrite allotments or existing plan settings", async () => {
  await asUser(owner);
  await db.query("insert into monthly_budget_plans(user_id,month_start,total_budget,expected_income,carry_over_enabled) values($1,'2091-02-01',1500,2000,false)",[owner]);
  const params=[JSON.stringify([{category_id:category,amount:700}]),JSON.stringify([{goal_id:goal,amount:300}])];
  await db.query("select initialize_monthly_budget('2091-02-01',1000,1000,true,$1::jsonb,$2::jsonb)",params);
  const plan=(await db.query("select * from monthly_budget_plans where month_start='2091-02-01'")).rows[0];
  assert.equal(plan.total_budget,"1500.00");
  assert.equal(plan.expected_income,"2000.00");
  assert.equal(plan.carry_over_enabled,false);
  await assert.rejects(db.query("select initialize_monthly_budget('2091-02-01',1000,1000,true,$1::jsonb,$2::jsonb)",params),/already has allotments/);
  assert.equal((await db.query("select amount from monthly_category_budgets where month_start='2091-02-01'")).rows[0].amount,"700.00");
});

test("security history is owner-only and tracking deletion is scoped", async () => {
  await asUser(owner);
  await db.query("select record_security_event('login_success',$1::jsonb)", [
    JSON.stringify({ provider: "google" }),
  ]);
  assert.equal((await db.query("select count(*)::int as n from security_events")).rows[0].n,1);

  await asUser(other);
  assert.equal((await db.query("select count(*)::int as n from security_events")).rows[0].n,0);

  await asUser(owner);
  await db.query("select delete_my_tracking_data()");
  assert.equal((await db.query("select count(*)::int as n from monthly_category_budgets")).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int as n from security_events")).rows[0].n,1);
});

test("payment completion checks amount and handles repeated callbacks once", async () => {
  await db.exec("reset role");
  await db.query(`insert into payment_checkout_sessions
    (external_id,user_id,plan,billing_period,period_months,expected_amount)
    values ('fht_test_payment',$1,'premium','quarterly',3,549)`,[owner]);
  await db.exec("set role service_role");
  await assert.rejects(
    db.query("select complete_payment_checkout('fht_test_payment','inv_bad',1,'PHP')"),
    /does not match/,
  );
  assert.equal(
    (await db.query("select complete_payment_checkout('fht_test_payment','inv_good',549,'PHP') as result")).rows[0].result,
    "activated",
  );
  assert.equal(
    (await db.query("select complete_payment_checkout('fht_test_payment','inv_good',549,'PHP') as result")).rows[0].result,
    "duplicate",
  );
  await db.exec("reset role");
  const sub=(await db.query("select plan,interval,status from subscriptions where user_id=$1",[owner])).rows[0];
  assert.deepEqual(sub,{plan:"premium",interval:"quarterly",status:"active"});
});

test("profiles cannot be deleted and recreated to escalate privileges", async () => {
  await asUser(owner);
  await assert.rejects(db.query("delete from profiles where user_id=$1", [owner]), /permission denied/);
  await assert.rejects(db.query("insert into profiles(user_id,role) values($1,'super_admin')", [owner]), /permission denied/);
  await assert.rejects(db.query("update profiles set role='super_admin' where user_id=$1", [owner]), /permission denied/);
  await db.query("update profiles set display_name='Updated settings' where user_id=$1", [owner]);
  assert.equal((await db.query("select display_name from profiles")).rows[0].display_name, "Updated settings");

  await db.exec("reset role; set role service_role");
  await db.query("update profiles set status='suspended' where user_id=$1", [owner]);
  assert.equal((await db.query("select status from profiles where user_id=$1", [owner])).rows[0].status, "suspended");
  await db.query("update profiles set status='active' where user_id=$1", [owner]);
});

test("feedback hides internal notes and prevents forged admin responses", async () => {
  await asUser(owner);
  await db.query("insert into feedback(user_id,title,message) values($1,'Test','Synthetic feedback')", [owner]);
  await assert.rejects(db.query("select admin_note from feedback"), /permission denied/);
  await assert.rejects(db.query("insert into feedback(user_id,title,message,admin_response) values($1,'Forged','Message','Approved')", [owner]), /permission denied/);
  assert.equal((await db.query("select title from feedback")).rows[0].title, "Test");
  await asUser(other);
  assert.equal((await db.query("select id from feedback")).rows.length, 0);

  await db.exec("reset role; set role service_role");
  await db.query("update feedback set admin_note='Private',admin_response='Received' where user_id=$1", [owner]);
  assert.equal((await db.query("select admin_note from feedback where user_id=$1", [owner])).rows[0].admin_note, "Private");
});

test("server-owned tables and trigger functions are not exposed to users", async () => {
  await asUser(owner);
  for (const table of ["user_invitations", "admin_audit_log", "app_schema_versions", "app_error_events"]) {
    await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
  }
  for (const fn of ["handle_new_user", "set_updated_at", "protect_profile_privileged"]) {
    assert.equal((await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') as allowed", [`public.${fn}()`])).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege('anon',$1,'EXECUTE') as allowed", [`public.${fn}()`])).rows[0].allowed, false);
  }
  await db.exec("reset role");
  const fresh="10000000-0000-4000-8000-000000000003";
  await db.query("insert into auth.users(id) values($1)", [fresh]);
  assert.equal((await db.query("select count(*)::int as n from profiles where user_id=$1", [fresh])).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from categories where user_id=$1", [fresh])).rows[0].n, 15);
});
