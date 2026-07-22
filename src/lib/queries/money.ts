import { addDays, format, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { monthRange } from "@/lib/date";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type {
  Account,
  AccountBalance,
  Category,
  Transaction,
} from "@/lib/supabase/types";

export type TransactionFilters = {
  accountId?: string;
  categoryId?: string;
  type?: Transaction["type"];
  from?: string; // ISO
  to?: string; // ISO
  limit?: number;
  offset?: number;
};

export async function getAccountsWithBalances(
  includeArchived = false,
): Promise<AccountBalance[]> {
  const supabase = await createClient();
  let query = supabase.from("account_balances").select("*");
  if (!includeArchived) query = query.eq("archived", false);
  const { data } = await query.returns<AccountBalance[]>();
  return (data ?? []).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAccounts(
  includeArchived = false,
): Promise<Account[]> {
  const supabase = await createClient();
  let query = supabase.from("accounts").select("*").order("sort_order");
  if (!includeArchived) query = query.eq("archived", false);
  const { data } = await query.returns<Account[]>();
  return data ?? [];
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("kind")
    .order("sort_order")
    .returns<Category[]>();
  return data ?? [];
}

export async function getTransactions(
  filters: TransactionFilters = {},
): Promise<Transaction[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("*")
    .order("occurred_at", { ascending: false });

  if (filters.accountId) {
    query = query.or(
      `account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`,
    );
  }
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.from) query = query.gte("occurred_at", filters.from);
  if (filters.to) query = query.lte("occurred_at", filters.to);

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data } = await query.returns<Transaction[]>();
  return data ?? [];
}

/**
 * Per-account end-of-day balance series for the last `days` (oldest → newest),
 * for account-card sparklines. Derived from current balances + recent flows.
 */
export async function getAccountSparklines(
  timezone: string,
  days = 14,
): Promise<Record<string, number[]>> {
  const supabase = await createClient();
  const balances = await getAccountsWithBalances(true);

  // Local today (noon) and the window start.
  const localToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const startKey = format(
    addDays(new Date(`${localToday}T12:00:00`), -(days - 1)),
    "yyyy-MM-dd",
  );
  const startISO = fromZonedTime(`${startKey}T00:00:00`, timezone).toISOString();

  const { data: txns } = await supabase
    .from("transactions")
    .select("type, amount, account_id, to_account_id, direction, occurred_at")
    .gte("occurred_at", startISO)
    .returns<
      Pick<
        Transaction,
        "type" | "amount" | "account_id" | "to_account_id" | "direction" | "occurred_at"
      >[]
    >();

  const dayKeyOf = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));

  // Signed delta per account per day.
  const delta = new Map<string, Map<string, number>>();
  const bump = (acc: string, day: string, v: number) => {
    const m = delta.get(acc) ?? new Map<string, number>();
    m.set(day, (m.get(day) ?? 0) + v);
    delta.set(acc, m);
  };
  for (const t of txns ?? []) {
    const day = dayKeyOf(t.occurred_at);
    const amt = Number(t.amount);
    if (t.type === "income") bump(t.account_id, day, amt);
    else if (t.type === "expense") bump(t.account_id, day, -amt);
    else if (t.type === "transfer") {
      bump(t.account_id, day, -amt);
      if (t.to_account_id) bump(t.to_account_id, day, amt);
    } else if (t.type === "adjustment") {
      bump(t.account_id, day, t.direction === "out" ? -amt : amt);
    }
  }

  // Day keys today → back, then reverse to oldest → newest.
  const dayKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    dayKeys.push(
      format(addDays(new Date(`${localToday}T12:00:00`), -i), "yyyy-MM-dd"),
    );
  }

  const result: Record<string, number[]> = {};
  for (const a of balances) {
    const accDelta = delta.get(a.id) ?? new Map<string, number>();
    let running = Number(a.balance); // end of today
    const seriesNewestFirst: number[] = [];
    for (const day of dayKeys) {
      seriesNewestFirst.push(running);
      running -= accDelta.get(day) ?? 0; // step back to previous day's close
    }
    result[a.id] = seriesNewestFirst.reverse();
  }

  return result;
}

export type MoneyOverview = {
  accounts: AccountBalance[];
  total: number;
  available: number;
  monthIncome: number;
  monthExpense: number;
  byCategory: { categoryId: string | null; amount: number }[];
  trend: { month: string; income: number; expense: number }[];
};

export async function getMoneyOverview(
  timezone: string,
): Promise<MoneyOverview> {
  const supabase = await createClient();
  const { start, end } = monthRange(timezone);
  const trendStart = subMonths(new Date(start), 5).toISOString();

  const [accounts, monthTx, trendTx] = await Promise.all([
    getAccountsWithBalances(false),
    supabase
      .from("transactions")
      .select("type, amount, category_id, occurred_at")
      .in("type", ["income", "expense"])
      .gte("occurred_at", start)
      .lte("occurred_at", end)
      .returns<
        Pick<Transaction, "type" | "amount" | "category_id" | "occurred_at">[]
      >(),
    supabase
      .from("transactions")
      .select("type, amount, occurred_at")
      .in("type", ["income", "expense"])
      .gte("occurred_at", trendStart)
      .returns<Pick<Transaction, "type" | "amount" | "occurred_at">[]>(),
  ]);

  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const available = accounts
    .filter((a) => a.is_spending)
    .reduce((s, a) => s + Number(a.balance), 0);

  const month = monthTx.data ?? [];
  const monthIncome = month
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = month
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const byCategoryMap = new Map<string | null, number>();
  for (const t of month) {
    if (t.type !== "expense") continue;
    const key = t.category_id;
    byCategoryMap.set(key, (byCategoryMap.get(key) ?? 0) + Number(t.amount));
  }
  const byCategory = [...byCategoryMap.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Trend: last 6 months bucketed by the user's local YYYY-MM (not server TZ).
  const zonedNow = toZonedTime(new Date(), timezone);
  const trendMap = new Map<string, { income: number; expense: number }>();
  for (let i = 5; i >= 0; i--) {
    trendMap.set(format(subMonths(zonedNow, i), "yyyy-MM"), {
      income: 0,
      expense: 0,
    });
  }
  for (const t of trendTx.data ?? []) {
    const key = format(toZonedTime(new Date(t.occurred_at), timezone), "yyyy-MM");
    const bucket = trendMap.get(key);
    if (!bucket) continue;
    if (t.type === "income") bucket.income += Number(t.amount);
    else bucket.expense += Number(t.amount);
  }
  const trend = [...trendMap.entries()].map(([month, v]) => ({
    month,
    income: v.income,
    expense: v.expense,
  }));

  return {
    accounts,
    total,
    available,
    monthIncome,
    monthExpense,
    byCategory,
    trend,
  };
}
