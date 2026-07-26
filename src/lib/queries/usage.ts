import { startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";

export type Usage = {
  transactions: number;
  accounts: number;
  habits: number;
  goals: number;
  budgets: number;
};

const EMPTY: Usage = {
  transactions: 0,
  accounts: 0,
  habits: 0,
  goals: 0,
  budgets: 0,
};

/** The signed-in user's current usage of limited resources (this month for tx). */
export async function getUsage(timezone: string): Promise<Usage> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const monthStart = fromZonedTime(
    startOfMonth(toZonedTime(new Date(), timezone)),
    timezone,
  ).toISOString();

  const head = { count: "exact" as const, head: true };
  const [tx, acc, hab, goal, bud] = await Promise.all([
    supabase
      .from("transactions")
      .select("id", head)
      .eq("user_id", user.id)
      .gte("occurred_at", monthStart),
    supabase
      .from("accounts")
      .select("id", head)
      .eq("user_id", user.id)
      .eq("archived", false),
    supabase
      .from("habits")
      .select("id", head)
      .eq("user_id", user.id)
      .eq("active", true),
    supabase.from("savings_goals").select("id", head).eq("user_id", user.id),
    supabase.from("budgets").select("id", head).eq("user_id", user.id),
  ]);

  return {
    transactions: tx.count ?? 0,
    accounts: acc.count ?? 0,
    habits: hab.count ?? 0,
    goals: goal.count ?? 0,
    budgets: bud.count ?? 0,
  };
}
