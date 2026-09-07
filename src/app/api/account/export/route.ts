import { createClient } from "@/lib/supabase/server";

const OWNED_TABLES = [
  "profiles",
  "accounts",
  "categories",
  "transactions",
  "budgets",
  "monthly_category_budgets",
  "monthly_budget_plans",
  "bills",
  "bill_payments",
  "habits",
  "habit_logs",
  "mood_entries",
  "tasks",
  "calendar_events",
  "ledger_entries",
  "assets",
  "liabilities",
  "savings_goals",
  "monthly_goal_allocations",
  "savings_goal_contributions",
  "subscriptions",
  "focus_sessions",
  "feedback",
  "promotion_offers",
  "security_events",
  "payment_checkout_sessions",
] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await supabase.rpc("record_security_event", {
    p_event_type: "data_exported",
    p_metadata: { format: "json" },
  });

  const entries = await Promise.all(
    OWNED_TABLES.map(async (table) => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", user.id);
      if (error) throw new Error(`Unable to export ${table}.`);
      return [table, data ?? []] as const;
    }),
  );

  const payload = {
    exported_at: new Date().toISOString(),
    account_email: user.email ?? null,
    data: Object.fromEntries(entries),
  };
  const date = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="finance-habit-data-${date}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
