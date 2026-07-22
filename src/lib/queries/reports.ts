import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  addMonths,
  addWeeks,
} from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { isScheduledOn } from "@/lib/habits";
import type {
  Account,
  Budget,
  Category,
  Habit,
  HabitLog,
  MoodEntry,
  Task,
  Transaction,
} from "@/lib/supabase/types";

export type ReportPeriod = "week" | "month";

export type Report = {
  period: ReportPeriod;
  label: string;
  offset: number;
  money: {
    income: number;
    expense: number;
    net: number;
    savingsInflow: number;
    byCategory: { name: string; amount: number }[];
    topMerchants: { name: string; amount: number }[];
    budgets: { met: number; exceeded: number };
  };
  habits: {
    completionPct: number;
    byArea: { area: string; pct: number }[];
    mostMissed: { name: string; missedPct: number }[];
  };
  mood: {
    avgMood: number | null;
    avgEnergy: number | null;
    avgStress: number | null;
    bestDay: string | null;
    hardestDay: string | null;
    entries: number;
  };
  tasks: {
    completed: number;
    topThreeHitRate: number | null;
    carriedOver: number;
  };
  summary: string;
};

function periodRange(
  period: ReportPeriod,
  anchor: Date,
  weekStartsOn: 0 | 1,
) {
  if (period === "week") {
    return {
      start: startOfWeek(anchor, { weekStartsOn }),
      end: endOfWeek(anchor, { weekStartsOn }),
    };
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
}

export async function getReport(
  timezone: string,
  period: ReportPeriod,
  offset: number,
  weekStartsOn: 0 | 1,
): Promise<Report> {
  const supabase = await createClient();
  const now = new Date();
  const anchor =
    period === "week" ? addWeeks(now, offset) : addMonths(now, offset);
  const { start, end } = periodRange(period, anchor, weekStartsOn);

  const startKey = format(start, "yyyy-MM-dd");
  const endKey = format(end, "yyyy-MM-dd");
  const startISO = fromZonedTime(`${startKey}T00:00:00`, timezone).toISOString();
  const endISO = fromZonedTime(`${endKey}T23:59:59`, timezone).toISOString();

  const [
    { data: txns },
    { data: accounts },
    { data: categories },
    { data: budgets },
    { data: habits },
    { data: logs },
    { data: moods },
    { data: completedTasks },
    { data: priorityTasks },
    { data: dueTasks },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, category_id, account_id, to_account_id, merchant, direction, occurred_at")
      .gte("occurred_at", startISO)
      .lte("occurred_at", endISO)
      .returns<Transaction[]>(),
    supabase.from("accounts").select("*").returns<Account[]>(),
    supabase.from("categories").select("*").returns<Category[]>(),
    supabase.from("budgets").select("*").eq("active", true).returns<Budget[]>(),
    supabase.from("habits").select("*").eq("active", true).returns<Habit[]>(),
    supabase
      .from("habit_logs")
      .select("habit_id, log_date, status")
      .gte("log_date", startKey)
      .lte("log_date", endKey)
      .returns<Pick<HabitLog, "habit_id" | "log_date" | "status">[]>(),
    supabase
      .from("mood_entries")
      .select("*")
      .gte("entry_date", startKey)
      .lte("entry_date", endKey)
      .returns<MoodEntry[]>(),
    supabase
      .from("tasks")
      .select("id, completed_at")
      .eq("status", "done")
      .gte("completed_at", startISO)
      .lte("completed_at", endISO)
      .returns<Pick<Task, "id" | "completed_at">[]>(),
    supabase
      .from("tasks")
      .select("id, status, priority_date, is_priority")
      .gte("priority_date", startKey)
      .lte("priority_date", endKey)
      .returns<Pick<Task, "id" | "status" | "priority_date" | "is_priority">[]>(),
    supabase
      .from("tasks")
      .select("id, status, due_date")
      .eq("status", "todo")
      .gte("due_date", startKey)
      .lte("due_date", endKey)
      .returns<Pick<Task, "id" | "status" | "due_date">[]>(),
  ]);

  const tx = txns ?? [];
  const savingsIds = new Set(
    (accounts ?? []).filter((a) => !a.is_spending).map((a) => a.id),
  );
  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));

  const income = tx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = tx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const savingsInflow =
    tx
      .filter((t) => t.type === "transfer" && t.to_account_id && savingsIds.has(t.to_account_id))
      .reduce((s, t) => s + Number(t.amount), 0) +
    tx
      .filter((t) => t.type === "income" && savingsIds.has(t.account_id))
      .reduce((s, t) => s + Number(t.amount), 0);

  const byCatMap = new Map<string, number>();
  const byMerchantMap = new Map<string, number>();
  for (const t of tx) {
    if (t.type !== "expense") continue;
    const cat = t.category_id ? (catName.get(t.category_id) ?? "Uncategorized") : "Uncategorized";
    byCatMap.set(cat, (byCatMap.get(cat) ?? 0) + Number(t.amount));
    if (t.merchant) {
      byMerchantMap.set(t.merchant, (byMerchantMap.get(t.merchant) ?? 0) + Number(t.amount));
    }
  }
  const byCategory = [...byCatMap.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  const topMerchants = [...byMerchantMap.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Budgets met vs exceeded (spend in period vs budget)
  let met = 0;
  let exceeded = 0;
  for (const b of budgets ?? []) {
    const spent = tx
      .filter((t) => t.type === "expense" && t.category_id === b.category_id)
      .reduce((s, t) => s + Number(t.amount), 0);
    if (spent > Number(b.amount)) exceeded++;
    else met++;
  }

  // Habits completion over the period
  const days = eachDayOfInterval({ start, end });
  const logMap = new Map<string, string>(); // `${habit}:${date}` → status
  for (const l of logs ?? []) logMap.set(`${l.habit_id}:${l.log_date}`, l.status);

  let habCompleted = 0;
  let habDenom = 0;
  const areaAgg = new Map<string, { c: number; d: number }>();
  const missedAgg: { name: string; missedPct: number }[] = [];
  for (const h of habits ?? []) {
    let c = 0;
    let d = 0;
    for (const day of days) {
      if (!isScheduledOn(h.schedule_days, day)) continue;
      const status = logMap.get(`${h.id}:${format(day, "yyyy-MM-dd")}`);
      if (status === "skipped") continue;
      d++;
      if (status === "completed") c++;
    }
    habCompleted += c;
    habDenom += d;
    const a = areaAgg.get(h.life_area) ?? { c: 0, d: 0 };
    a.c += c;
    a.d += d;
    areaAgg.set(h.life_area, a);
    if (d > 0 && c < d) {
      missedAgg.push({ name: h.name, missedPct: Math.round((1 - c / d) * 100) });
    }
  }

  const byArea = [...areaAgg.entries()]
    .filter(([, v]) => v.d > 0)
    .map(([area, v]) => ({ area, pct: Math.round((v.c / v.d) * 100) }))
    .sort((a, b) => b.pct - a.pct);
  const mostMissed = missedAgg.sort((a, b) => b.missedPct - a.missedPct).slice(0, 5);

  // Mood
  const moodRows = moods ?? [];
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : null;
  const avgMood = avg(moodRows.map((m) => m.mood));
  const avgEnergy = avg(moodRows.filter((m) => m.energy != null).map((m) => m.energy as number));
  const avgStress = avg(moodRows.filter((m) => m.stress != null).map((m) => m.stress as number));
  let bestDay: string | null = null;
  let hardestDay: string | null = null;
  if (moodRows.length) {
    const sorted = [...moodRows].sort((a, b) => b.mood - a.mood);
    bestDay = sorted[0].entry_date;
    hardestDay = sorted[sorted.length - 1].entry_date;
  }

  // Tasks
  const completed = (completedTasks ?? []).length;
  // top-3 hit rate: days with priorities where all were done
  const byDay = new Map<string, { total: number; done: number }>();
  for (const t of priorityTasks ?? []) {
    if (!t.priority_date) continue;
    const rec = byDay.get(t.priority_date) ?? { total: 0, done: 0 };
    rec.total++;
    if (t.status === "done") rec.done++;
    byDay.set(t.priority_date, rec);
  }
  let hitDays = 0;
  for (const rec of byDay.values()) {
    if (rec.total > 0 && rec.done === rec.total) hitDays++;
  }
  const topThreeHitRate =
    byDay.size > 0 ? Math.round((hitDays / byDay.size) * 100) : null;
  const carriedOver = (dueTasks ?? []).length;

  const completionPct =
    habDenom > 0 ? Math.round((habCompleted / habDenom) * 100) : 0;

  const label =
    period === "week"
      ? `${format(start, "d MMM")} – ${format(end, "d MMM")}`
      : format(start, "MMMM yyyy");

  const summary = buildSummary({
    period,
    completionPct,
    expense,
    byCategory,
    budgetsExceeded: exceeded,
    avgMood,
    completed,
  });

  return {
    period,
    label,
    offset,
    money: {
      income,
      expense,
      net: income - expense,
      savingsInflow,
      byCategory,
      topMerchants,
      budgets: { met, exceeded },
    },
    habits: { completionPct, byArea, mostMissed },
    mood: {
      avgMood,
      avgEnergy,
      avgStress,
      bestDay,
      hardestDay,
      entries: moodRows.length,
    },
    tasks: { completed, topThreeHitRate, carriedOver },
    summary,
  };
}

function buildSummary(d: {
  period: ReportPeriod;
  completionPct: number;
  expense: number;
  byCategory: { name: string; amount: number }[];
  budgetsExceeded: number;
  avgMood: number | null;
  completed: number;
}): string {
  const parts: string[] = [];
  parts.push(
    `You completed ${d.completionPct}% of your scheduled habits this ${d.period}.`,
  );
  if (d.expense > 0) {
    const top = d.byCategory[0];
    parts.push(
      `You spent across ${d.byCategory.length} categor${
        d.byCategory.length === 1 ? "y" : "ies"
      }${top ? `, most on ${top.name}` : ""}.`,
    );
  }
  if (d.budgetsExceeded > 0) {
    parts.push(
      `${d.budgetsExceeded} budget${d.budgetsExceeded === 1 ? " was" : "s were"} exceeded.`,
    );
  }
  if (d.completed > 0) {
    parts.push(`You finished ${d.completed} task${d.completed === 1 ? "" : "s"}.`);
  }
  if (d.avgMood != null) {
    parts.push(`Your average mood was ${d.avgMood.toFixed(1)}/5.`);
  }
  return parts.join(" ");
}
