import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/date";
import {
  currentStreak,
  longestStreak,
  consistency,
  lastNDays,
  toLogMap,
  isScheduledOn,
} from "@/lib/habits";
import type { Habit, HabitLog, HabitStatus } from "@/lib/supabase/types";

/** The user's local "today" as a Date built from their calendar date (noon). */
export function localToday(timezone: string): Date {
  const [y, m, d] = localDateKey(timezone).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export type HabitBoardItem = {
  habit: Habit;
  todayStatus: HabitStatus | null;
  scheduledToday: boolean;
  last7: { date: string; status: HabitStatus | null }[];
  streak: number;
  longest: number;
  weeklyPct: number;
  monthlyPct: number;
};

async function fetchHabitsAndLogs(timezone: string, lookbackDays = 400) {
  const supabase = await createClient();
  const today = localToday(timezone);
  const since = format(addDays(today, -lookbackDays), "yyyy-MM-dd");

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase
      .from("habits")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .returns<Habit[]>(),
    supabase
      .from("habit_logs")
      .select("habit_id, log_date, status")
      .gte("log_date", since)
      .returns<Pick<HabitLog, "habit_id" | "log_date" | "status">[]>(),
  ]);

  const byHabit = new Map<
    string,
    { log_date: string; status: HabitStatus }[]
  >();
  for (const l of logs ?? []) {
    const arr = byHabit.get(l.habit_id) ?? [];
    arr.push({ log_date: l.log_date, status: l.status });
    byHabit.set(l.habit_id, arr);
  }

  return { habits: habits ?? [], byHabit, today };
}

export async function getHabitsBoard(
  timezone: string,
): Promise<HabitBoardItem[]> {
  const { habits, byHabit, today } = await fetchHabitsAndLogs(timezone);
  const todayKey = format(today, "yyyy-MM-dd");

  return habits.map((habit) => {
    const logs = toLogMap(byHabit.get(habit.id) ?? []);
    return {
      habit,
      todayStatus: logs.get(todayKey) ?? null,
      scheduledToday: isScheduledOn(habit.schedule_days, today),
      last7: lastNDays(logs, today, 7),
      streak: currentStreak(logs, habit.schedule_days, today),
      longest: longestStreak(logs, habit.schedule_days, today),
      weeklyPct: consistency(logs, habit.schedule_days, today, 7),
      monthlyPct: consistency(logs, habit.schedule_days, today, 30),
    };
  });
}

export type HabitDetail = {
  habit: Habit;
  streak: number;
  longest: number;
  weeklyPct: number;
  monthlyPct: number;
  month: { date: string; status: HabitStatus | null; scheduled: boolean }[];
};

export async function getHabitDetail(
  timezone: string,
  habitId: string,
): Promise<HabitDetail | null> {
  const supabase = await createClient();
  const today = localToday(timezone);

  const { data: habit } = await supabase
    .from("habits")
    .select("*")
    .eq("id", habitId)
    .single<Habit>();
  if (!habit) return null;

  const since = format(addDays(today, -400), "yyyy-MM-dd");
  const { data: logs } = await supabase
    .from("habit_logs")
    .select("log_date, status")
    .eq("habit_id", habitId)
    .gte("log_date", since)
    .returns<Pick<HabitLog, "log_date" | "status">[]>();

  const logMap = toLogMap(logs ?? []);

  // current calendar month days
  const year = today.getFullYear();
  const monthIdx = today.getMonth();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const month = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIdx, day, 12);
    const key = format(d, "yyyy-MM-dd");
    month.push({
      date: key,
      status: logMap.get(key) ?? null,
      scheduled: isScheduledOn(habit.schedule_days, d),
    });
  }

  return {
    habit,
    streak: currentStreak(logMap, habit.schedule_days, today),
    longest: longestStreak(logMap, habit.schedule_days, today),
    weeklyPct: consistency(logMap, habit.schedule_days, today, 7),
    monthlyPct: consistency(logMap, habit.schedule_days, today, 30),
    month,
  };
}

// ---- Month grid (spreadsheet-style tracker) ------------------------------

export type HabitGridCell = {
  day: number;
  date: string;
  status: HabitStatus | null;
  scheduled: boolean;
  future: boolean;
};

export type HabitGridRow = {
  habit: Habit;
  cells: HabitGridCell[];
  total: number; // completed
  goal: number; // scheduled days this month
  pct: number;
};

export type HabitGrid = {
  monthLabel: string;
  today: string;
  daysInMonth: number;
  rows: HabitGridRow[];
};

export async function getHabitGrid(timezone: string): Promise<HabitGrid> {
  const { habits, byHabit, today } = await fetchHabitsAndLogs(timezone, 40);
  const todayKey = format(today, "yyyy-MM-dd");
  const year = today.getFullYear();
  const monthIdx = today.getMonth();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  const rows: HabitGridRow[] = habits.map((habit) => {
    const logs = toLogMap(byHabit.get(habit.id) ?? []);
    let total = 0;
    let goal = 0;
    const cells: HabitGridCell[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, monthIdx, day, 12);
      const key = format(d, "yyyy-MM-dd");
      const scheduled = isScheduledOn(habit.schedule_days, d);
      const status = logs.get(key) ?? null;
      if (scheduled) goal++;
      if (status === "completed") total++;
      cells.push({ day, date: key, status, scheduled, future: key > todayKey });
    }
    return {
      habit,
      cells,
      total,
      goal,
      pct: goal > 0 ? Math.round((total / goal) * 100) : 0,
    };
  });

  return {
    monthLabel: today.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    today: todayKey,
    daysInMonth,
    rows,
  };
}

export type HabitStats = {
  overallPct: number;
  mostMissed: { habit: Habit; missedRate: number }[];
  bestArea: { area: string; pct: number } | null;
};

export async function getHabitStats(timezone: string): Promise<HabitStats> {
  const { habits, byHabit, today } = await fetchHabitsAndLogs(timezone, 40);

  let totalCompleted = 0;
  let totalDenom = 0;
  const missed: { habit: Habit; missedRate: number }[] = [];
  const areaAgg = new Map<string, { completed: number; denom: number }>();

  for (const habit of habits) {
    const logs = toLogMap(byHabit.get(habit.id) ?? []);
    let completed = 0;
    let denom = 0;
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, -i);
      if (!isScheduledOn(habit.schedule_days, d)) continue;
      const key = format(d, "yyyy-MM-dd");
      const status = logs.get(key);
      if (status === "skipped") continue;
      if (key === format(today, "yyyy-MM-dd") && status === undefined) continue;
      denom++;
      if (status === "completed") completed++;
    }
    totalCompleted += completed;
    totalDenom += denom;
    if (denom > 0) {
      missed.push({ habit, missedRate: 1 - completed / denom });
      const a = areaAgg.get(habit.life_area) ?? { completed: 0, denom: 0 };
      a.completed += completed;
      a.denom += denom;
      areaAgg.set(habit.life_area, a);
    }
  }

  let bestArea: HabitStats["bestArea"] = null;
  for (const [area, v] of areaAgg) {
    const pct = Math.round((v.completed / v.denom) * 100);
    if (!bestArea || pct > bestArea.pct) bestArea = { area, pct };
  }

  return {
    overallPct:
      totalDenom === 0 ? 0 : Math.round((totalCompleted / totalDenom) * 100),
    mostMissed: missed
      .filter((m) => m.missedRate > 0)
      .sort((a, b) => b.missedRate - a.missedRate)
      .slice(0, 5),
    bestArea,
  };
}
