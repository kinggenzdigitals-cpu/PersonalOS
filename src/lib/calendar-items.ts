import { isScheduledOn } from "@/lib/habits";
import type {
  Bill,
  CalendarEvent,
  CalendarEventKind,
  Habit,
  Task,
} from "@/lib/supabase/types";
import type { CalendarData } from "@/lib/queries/calendar";

export type { CalendarData };

export type CalendarSource = "event" | "task" | "bill" | "habit";

export type CalItem = {
  id: string;
  source: CalendarSource;
  title: string;
  meta?: string;
  time?: string; // HH:mm (timed events only)
  allDay: boolean;
  color: string;
  event?: CalendarEvent;
  task?: Task;
  bill?: Bill;
  habit?: Habit;
};

export const SOURCE_META: Record<
  CalendarSource,
  { label: string; color: string }
> = {
  event: { label: "Events", color: "var(--brand)" },
  task: { label: "Tasks", color: "var(--chart-4)" },
  bill: { label: "Bills", color: "var(--warning)" },
  habit: { label: "Habits", color: "var(--sage)" },
};

const EVENT_KIND_COLOR: Record<CalendarEventKind, string> = {
  appointment: "var(--brand)",
  personal: "var(--sage)",
  work: "var(--chart-4)",
  other: "var(--chart-3)",
};

function localKey(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function localTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Build the merged, sorted list of items for a single day. */
export function buildDayItems(
  data: CalendarData,
  dateKey: string,
  timezone: string,
): CalItem[] {
  const items: CalItem[] = [];
  const date = new Date(`${dateKey}T12:00:00`);

  for (const e of data.events) {
    if (localKey(e.start_at, timezone) !== dateKey) continue;
    items.push({
      id: `event-${e.id}`,
      source: "event",
      title: e.title,
      meta: e.location ?? undefined,
      time: e.all_day ? undefined : localTime(e.start_at, timezone),
      allDay: e.all_day,
      color: EVENT_KIND_COLOR[e.kind],
      event: e,
    });
  }
  for (const t of data.tasks) {
    if (t.due_date !== dateKey) continue;
    items.push({
      id: `task-${t.id}`,
      source: "task",
      title: t.title,
      meta: t.status === "done" ? "Done" : "Due",
      allDay: true,
      color: SOURCE_META.task.color,
      task: t,
    });
  }
  for (const b of data.bills) {
    if (b.next_due_date !== dateKey) continue;
    items.push({
      id: `bill-${b.id}`,
      source: "bill",
      title: b.name,
      meta: "Bill due",
      allDay: true,
      color: SOURCE_META.bill.color,
      bill: b,
    });
  }
  for (const h of data.habits) {
    if (!isScheduledOn(h.schedule_days, date)) continue;
    items.push({
      id: `habit-${h.id}`,
      source: "habit",
      title: h.name,
      allDay: true,
      color: SOURCE_META.habit.color,
      habit: h,
    });
  }

  // Timed first (by time), then all-day.
  return items.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? 1 : -1;
    return (a.time ?? "").localeCompare(b.time ?? "");
  });
}

/** Per-source counts for a day (for month-grid dots). */
export function daySourceCounts(
  data: CalendarData,
  dateKey: string,
  timezone: string,
): Partial<Record<CalendarSource, number>> {
  const counts: Partial<Record<CalendarSource, number>> = {};
  for (const item of buildDayItems(data, dateKey, timezone)) {
    counts[item.source] = (counts[item.source] ?? 0) + 1;
  }
  return counts;
}
