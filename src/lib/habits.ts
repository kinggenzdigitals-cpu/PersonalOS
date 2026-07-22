import { addDays, format, parseISO } from "date-fns";
import type { HabitStatus } from "@/lib/supabase/types";

/** A habit is scheduled on `date` if schedule_days is empty or includes its weekday. */
export function isScheduledOn(scheduleDays: number[], date: Date): boolean {
  if (!scheduleDays || scheduleDays.length === 0) return true;
  return scheduleDays.includes(date.getDay());
}

/** Tap cycle: none → completed → skipped → missed → none. */
export function nextStatus(
  current: HabitStatus | null | undefined,
): HabitStatus | null {
  switch (current) {
    case undefined:
    case null:
      return "completed";
    case "completed":
      return "skipped";
    case "skipped":
      return "missed";
    case "missed":
      return null;
  }
}

export type LogMap = Map<string, HabitStatus>; // dateKey → status

const KEY = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Current streak: walk scheduled days backward from `today`.
 * - completed → extends (counts)
 * - skipped → preserves (neither breaks nor counts)
 * - today untouched → neutral (day not over)
 * - past untouched or missed → breaks
 */
export function currentStreak(
  logs: LogMap,
  scheduleDays: number[],
  today: Date,
  lookbackDays = 400,
): number {
  let streak = 0;
  const todayKey = KEY(today);
  for (let i = 0; i <= lookbackDays; i++) {
    const d = addDays(today, -i);
    if (!isScheduledOn(scheduleDays, d)) continue;
    const status = logs.get(KEY(d));
    if (status === "completed") {
      streak++;
    } else if (status === "skipped") {
      // preserve
    } else if (KEY(d) === todayKey && status === undefined) {
      // today not logged yet — day isn't over, don't break
    } else {
      break;
    }
  }
  return streak;
}

/** Longest completed streak within the lookback window. */
export function longestStreak(
  logs: LogMap,
  scheduleDays: number[],
  today: Date,
  lookbackDays = 400,
): number {
  let best = 0;
  let cur = 0;
  const todayKey = KEY(today);
  for (let i = lookbackDays; i >= 0; i--) {
    const d = addDays(today, -i);
    if (!isScheduledOn(scheduleDays, d)) continue;
    const status = logs.get(KEY(d));
    if (status === "completed") {
      cur++;
      best = Math.max(best, cur);
    } else if (status === "skipped") {
      // preserve current run
    } else if (KEY(d) === todayKey && status === undefined) {
      // today not over — don't reset
    } else {
      cur = 0;
    }
  }
  return best;
}

/**
 * Consistency % over the last `days` (inclusive of today).
 * completed / (scheduled days that weren't intentionally skipped).
 */
export function consistency(
  logs: LogMap,
  scheduleDays: number[],
  today: Date,
  days: number,
): number {
  let completed = 0;
  let denom = 0;
  const todayKey = KEY(today);
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    if (!isScheduledOn(scheduleDays, d)) continue;
    const status = logs.get(KEY(d));
    if (status === "skipped") continue; // excluded from denominator
    if (KEY(d) === todayKey && status === undefined) continue; // today pending
    denom++;
    if (status === "completed") completed++;
  }
  return denom === 0 ? 0 : Math.round((completed / denom) * 100);
}

/** The last N days (oldest→newest) with status for the weekly strip. */
export function lastNDays(
  logs: LogMap,
  today: Date,
  n: number,
): { date: string; status: HabitStatus | null }[] {
  const out: { date: string; status: HabitStatus | null }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    out.push({ date: KEY(d), status: logs.get(KEY(d)) ?? null });
  }
  return out;
}

/** Build a LogMap from rows. */
export function toLogMap(
  rows: { log_date: string; status: HabitStatus }[],
): LogMap {
  const m: LogMap = new Map();
  for (const r of rows) m.set(r.log_date, r.status);
  return m;
}

export { KEY as dateKey, parseISO };
