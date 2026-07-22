import { createClient } from "@/lib/supabase/server";
import { fromZonedTime } from "date-fns-tz";
import type {
  Bill,
  CalendarEvent,
  Habit,
  Task,
} from "@/lib/supabase/types";

export type CalendarData = {
  events: CalendarEvent[];
  tasks: Task[];
  bills: Bill[];
  habits: Habit[];
};

/**
 * Everything the calendar renders for a visible date range.
 * `fromKey`/`toKey` are YYYY-MM-DD (inclusive) in the user's timezone.
 */
export async function getCalendarRange(
  fromKey: string,
  toKey: string,
  timezone: string,
): Promise<CalendarData> {
  const supabase = await createClient();
  const startISO = fromZonedTime(`${fromKey}T00:00:00`, timezone).toISOString();
  const endISO = fromZonedTime(`${toKey}T23:59:59`, timezone).toISOString();

  const [events, tasks, bills, habits] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("*")
      .gte("start_at", startISO)
      .lte("start_at", endISO)
      .order("start_at")
      .returns<CalendarEvent[]>(),
    supabase
      .from("tasks")
      .select("*")
      .not("due_date", "is", null)
      .gte("due_date", fromKey)
      .lte("due_date", toKey)
      .in("status", ["todo", "done"])
      .returns<Task[]>(),
    supabase
      .from("bills")
      .select("*")
      .eq("active", true)
      .gte("next_due_date", fromKey)
      .lte("next_due_date", toKey)
      .returns<Bill[]>(),
    supabase
      .from("habits")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .returns<Habit[]>(),
  ]);

  return {
    events: events.data ?? [],
    tasks: tasks.data ?? [],
    bills: bills.data ?? [],
    habits: habits.data ?? [],
  };
}
