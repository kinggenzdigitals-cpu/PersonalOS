import { startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";

export type FocusSummary = {
  completedSessions: number;
  focusedMinutes: number;
  linkedSessions: number;
};

const EMPTY: FocusSummary = {
  completedSessions: 0,
  focusedMinutes: 0,
  linkedSessions: 0,
};

/** Today's focus stats in the user's timezone. Tolerant of the table missing. */
export async function getTodayFocusSummary(
  timezone: string,
): Promise<FocusSummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const localMidnight = startOfDay(toZonedTime(new Date(), timezone));
  const dayStartUtc = fromZonedTime(localMidnight, timezone).toISOString();

  const { data, error } = await supabase
    .from("focus_sessions")
    .select("session_type, actual_seconds, task_id, habit_id")
    .eq("user_id", user.id)
    .eq("completed", true)
    .gte("started_at", dayStartUtc);

  // 42P01 = table missing (migration not applied yet) → treat as no sessions.
  if (error) return EMPTY;

  const focus = (data ?? []).filter((s) => s.session_type === "focus");
  return {
    completedSessions: focus.length,
    focusedMinutes: Math.round(
      focus.reduce((sum, s) => sum + (s.actual_seconds ?? 0), 0) / 60,
    ),
    linkedSessions: focus.filter((s) => s.task_id || s.habit_id).length,
  };
}

export type FocusLinkOptions = {
  tasks: { id: string; title: string }[];
  habits: { id: string; name: string }[];
};

/** Open tasks + active habits a focus session can be linked to. */
export async function getFocusLinkOptions(): Promise<FocusLinkOptions> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { tasks: [], habits: [] };

  const [tasksRes, habitsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title")
      .eq("user_id", user.id)
      .eq("status", "todo")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("habits")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order")
      .limit(50),
  ]);

  return {
    tasks: (tasksRes.data as { id: string; title: string }[] | null) ?? [],
    habits: (habitsRes.data as { id: string; name: string }[] | null) ?? [],
  };
}
