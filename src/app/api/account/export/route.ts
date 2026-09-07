import { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/queries/all-rows";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const FEEDBACK_COLUMNS = "id,user_id,category,title,message,screenshot_url,status,admin_response,is_duplicate,archived,created_at,updated_at";

const OWNED_TABLES = [
  "profiles",
  "accounts",
  "account_reconciliations",
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
    return Response.json({ error: "unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }

  let entries;
  try {
    entries = await Promise.all(
      OWNED_TABLES.map(async (table) => {
        const columns = table === "feedback" ? FEEDBACK_COLUMNS : "*";
        const rows = await allRows(
          (from, to) => supabase
            .from(table)
            .select(columns, { count: "exact" })
            .eq("user_id", user.id)
            .order("id", { ascending: true })
            .range(from, to),
          "Unable to export your data. Please try again.",
        );
        return [table, rows] as const;
      }),
    );
  } catch {
    // Never deliver a file containing only part of the user's records.
    return Response.json(
      { error: "Your data couldn't be exported. Please try again." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }

  await supabase.rpc("record_security_event", {
    p_event_type: "data_exported",
    p_metadata: { format: "json" },
  });

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
      ...PRIVATE_HEADERS,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
