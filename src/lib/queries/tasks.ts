import { createClient } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/date";
import type { Task } from "@/lib/supabase/types";

export type TaskView = "today" | "upcoming" | "backlog" | "done";

export async function getTasksByView(
  view: TaskView,
  timezone: string,
): Promise<Task[]> {
  const supabase = await createClient();
  const today = localDateKey(timezone);
  let query = supabase.from("tasks").select("*");

  switch (view) {
    case "today":
      // Due today or earlier, plus undated todos (so they never disappear).
      query = query
        .eq("status", "todo")
        .or(`due_date.lte.${today},due_date.is.null`)
        .order("is_priority", { ascending: false })
        .order("sort_order");
      break;
    case "upcoming":
      query = query
        .eq("status", "todo")
        .gt("due_date", today)
        .order("due_date");
      break;
    case "backlog":
      query = query
        .eq("status", "backlog")
        .order("created_at", { ascending: false });
      break;
    case "done":
      query = query
        .in("status", ["done", "cancelled"])
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(100);
      break;
  }

  const { data } = await query.returns<Task[]>();
  return data ?? [];
}

/** Today's top-3 priority tasks (is_priority for today). */
export async function getTodayPriorities(timezone: string): Promise<Task[]> {
  const supabase = await createClient();
  const today = localDateKey(timezone);
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("is_priority", true)
    .eq("priority_date", today)
    .order("sort_order")
    .returns<Task[]>();
  return data ?? [];
}

/** Candidate tasks for the top-3 picker: today's todo + backlog. */
export async function getPriorityCandidates(
  timezone: string,
): Promise<Task[]> {
  const supabase = await createClient();
  const today = localDateKey(timezone);
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .or(
      `and(status.eq.todo,due_date.lte.${today}),and(status.eq.todo,due_date.is.null),status.eq.backlog`,
    )
    .order("is_priority", { ascending: false })
    .order("sort_order")
    .limit(50)
    .returns<Task[]>();
  return data ?? [];
}

/** Yesterday-or-earlier unfinished dated tasks (carry-over candidates). */
export async function getCarryOverTasks(timezone: string): Promise<Task[]> {
  const supabase = await createClient();
  const today = localDateKey(timezone);
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "todo")
    .lt("due_date", today)
    .order("due_date")
    .returns<Task[]>();
  return data ?? [];
}
