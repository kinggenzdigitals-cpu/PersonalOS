const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./load-typescript.cjs");
const math = loadSource("src/lib/budget-math.ts");
const month = loadSource("src/lib/month.ts");
const { allRows } = loadSource("src/lib/queries/all-rows.ts");
const bud = (date, amount) => ({ category_id: "food", month_start: date, amount });
const exp = (date, amount) => ({ category_id: "food", occurred_at: date + "T12:00:00+08:00", amount });
const plans = ["2026-07-01", "2026-08-01", "2026-09-01"].map(month_start => ({month_start, carry_over_enabled:true}));

test("cumulative carry-over keeps July's unused money in September", () => {
  const result = math.categoryCarryovers([bud("2026-07-01",1000),bud("2026-08-01",1000),bud("2026-09-01",1000)], plans,
    [exp("2026-07-20",600),exp("2026-08-20",300)], "2026-09-01","Asia/Manila","2026-09-07");
  assert.equal(result.get("food"),1100);
});
test("disabled or missing months stop carry-over, overspending never carries debt", () => {
  assert.equal(math.categoryCarryovers([bud("2026-07-01",1000),bud("2026-09-01",1000)],plans,[],"2026-09-01","Asia/Manila","2026-09-07").get("food"),0);
  assert.equal(math.categoryCarryovers([bud("2026-08-01",1000),bud("2026-09-01",1000)],[],[],"2026-09-01","Asia/Manila","2026-09-07").get("food"),0);
  assert.equal(math.categoryCarryovers([bud("2026-08-01",1000),bud("2026-09-01",1000)],plans,[exp("2026-08-20",1400)],"2026-09-01","Asia/Manila","2026-09-07").get("food"),0);
});
test("future months do not count unfinished month leftovers", () => {
  assert.equal(math.categoryCarryovers([bud("2026-08-01",1000),bud("2026-09-01",1000)],plans,[],"2026-09-01","Asia/Manila","2026-08-20").size,0);
});
test("forecast distinguishes current, historical and future months", () => {
  assert.equal(math.forecastExpense(700,"2026-09-01","2026-09-07"),3000);
  assert.equal(math.forecastExpense(700,"2026-08-01","2026-09-07"),700);
  assert.equal(math.forecastExpense(700,"2026-10-01","2026-09-07"),0);
});
test("today's cash snapshot excludes future income, expenses and transfers", () => {
  const accounts=[{id:"cash",is_spending:true,balance:1200},{id:"savings",is_spending:false,balance:2000}];
  const flows=[
    {type:"income",amount:500,account_id:"cash",to_account_id:null,direction:null},
    {type:"expense",amount:200,account_id:"cash",to_account_id:null,direction:null},
    {type:"transfer",amount:100,account_id:"cash",to_account_id:"savings",direction:null},
  ];
  assert.equal(math.spendingCashNow(accounts,flows),1000);
});
test("all savings contributions count even without an active allotment", () => {
  assert.deepEqual(math.budgetTotals({totalBudget:40000, expenseAllocated:30000,savingsAllocated:5000,carryover:1000,spent:12000,contributions:[{amount:3000},{amount:4000}]}),
    {savedThisMonth:7000,allocated:35000,unallocated:5000,remaining:22000,spendingCeiling:34000});
});
test("weekly bills count every unpaid occurrence", () => {
  const bills = [{id:"weekly",amount:100,next_due_date:"2026-09-02",frequency:"weekly"}];
  assert.equal(math.billsDueThrough(bills,[],"2026-09-30"),500);
  assert.equal(math.billsDueThrough(bills,[{bill_id:"weekly",paid_for_date:"2026-09-09"}],"2026-09-30"),400);
});
test("month-end bills keep their anchor day after February; once bills do not repeat", () => {
  assert.equal(math.billsDueThrough([{id:"a",amount:100,next_due_date:"2028-01-31",frequency:"monthly"}],[],"2028-03-30"),200);
  assert.equal(math.billsDueThrough([{id:"a",amount:100,next_due_date:"2028-01-31",frequency:"once"}],[],"2028-03-30"),100);
});
test("Manila boundaries, leap years and invalid month query values", () => {
  assert.equal(month.monthDateRange("Asia/Manila","2028-02-01").start,"2028-01-31T16:00:00.000Z");
  assert.equal(month.monthDateRange("Asia/Manila","2028-02-01").end,"2028-02-29T15:59:59.999Z");
  for (const value of [[],"0000-01-01","2026-13-01","2026-02-31",null]) assert.equal(month.isMonthStart(value),false);
  assert.equal(month.shiftMonthStart("2026-12-01",1),"2027-01-01");
});
test("paginate more than 1,000 records and fail closed on query errors", async () => {
  const data = Array.from({length:1201},(_,id)=>({id}));
  assert.equal((await allRows((from,to)=>Promise.resolve({data:data.slice(from,to+1),error:null}))).length,1201);
  await assert.rejects(allRows(()=>Promise.resolve({data:null,error:{message:"timeout"}})),/could not be loaded/);
});
test("goal metadata edits never overwrite contributed savings", async () => {
  let written;
  const client={auth:{getUser:async()=>({data:{user:{id:"owner"}}})},from:()=>({update:row=>{written=row;return {eq:async()=>({error:null})};}})};
  const actions=loadSource("src/app/(app)/money/goals-actions.ts", {
    "@/lib/supabase/server":{createClient:async()=>client},
    "@/lib/plan-guard":{checkCap:async()=>null},"next/cache":{revalidatePath:()=>{}},
  });
  const result=await actions.upsertSavingsGoal({id:"goal",name:"Car",targetAmount:5000,savedAmount:1000,goalType:"sinking_fund"});
  assert.equal(result.ok,true);
  assert.equal("saved_amount" in written,false);
});
test("recommendation amounts respect the privacy mask", () => {
  const {maskAmountsInText}=loadSource("src/lib/format.ts");
  assert.equal(maskAmountsInText("Reduce by ₱1,000.00."),"Reduce by ₱••••••.");
  const source=require("node:fs").readFileSync(require("node:path").join(__dirname,"../src/components/money/budget-planner-view.tsx"),"utf8");
  assert.match(source,/<MaskAmounts text=\{item.detail\}/);
});
