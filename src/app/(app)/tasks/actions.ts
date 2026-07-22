"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/date";
import type { Task, TaskStatus } from "@/lib/supabase/types";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; code?: "cap" };

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let timezone = "Asia/Manila";
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("user_id", user.id)
      .single<{ timezone: string }>();
    timezone = data?.timezone ?? timezone;
  }
  return { supabase, user, timezone };
}

function revalidate() {
  revalidatePath("/", "layout");
}

export type TaskInput = {
  title: string;
  dueDate: string | null;
  notes?: string | null;
  makePriority?: boolean;
};

export async function createTask(input: TaskInput): Promise<ActionResult> {
  const { supabase, user, timezone } = await ctx();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.title.trim()) return { ok: false, error: "Give the task a title." };

  const today = localDateKey(timezone);
  let isPriority = false;
  let priorityDate: string | null = null;

  if (input.makePriority) {
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("is_priority", true)
      .eq("priority_date", today);
    if ((count ?? 0) >= 3) {
      return {
        ok: false,
        error: "You already have 3 top priorities today.",
        code: "cap",
      };
    }
    isPriority = true;
    priorityDate = today;
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: input.title.trim(),
      due_date: input.dueDate,
      notes: input.notes?.trim() || null,
      status: "todo",
      is_priority: isPriority,
      priority_date: priorityDate,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function updateTask(
  id: string,
  input: { title: string; dueDate: string | null; notes?: string | null },
): Promise<ActionResult> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.title.trim()) return { ok: false, error: "Give the task a title." };

  const { error } = await supabase
    .from("tasks")
    .update({
      title: input.title.trim(),
      due_date: input.dueDate,
      notes: input.notes?.trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function setTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<ActionResult> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: "You're not signed in." };

  const patch: Partial<Task> = {
    status,
    completed_at: status === "done" ? new Date().toISOString() : null,
  };
  // Leaving the todo state clears its priority flag.
  if (status !== "todo") {
    patch.is_priority = false;
  }

  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id };
}

export async function moveTask(
  id: string,
  dueDate: string | null,
): Promise<ActionResult> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase
    .from("tasks")
    .update({ due_date: dueDate, status: "todo" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id };
}

/** Set exactly these tasks (max 3) as today's priorities, clearing the rest. */
export async function setTodayPriorities(
  taskIds: string[],
): Promise<ActionResult> {
  const { supabase, user, timezone } = await ctx();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (taskIds.length > 3) {
    return { ok: false, error: "You can pick at most 3.", code: "cap" };
  }
  const today = localDateKey(timezone);

  // Clear today's current priorities.
  const { error: clearErr } = await supabase
    .from("tasks")
    .update({ is_priority: false })
    .eq("priority_date", today)
    .eq("is_priority", true);
  if (clearErr) return { ok: false, error: clearErr.message };

  if (taskIds.length > 0) {
    const { error: setErr } = await supabase
      .from("tasks")
      .update({ is_priority: true, priority_date: today, status: "todo" })
      .in("id", taskIds);
    if (setErr) return { ok: false, error: setErr.message };
  }

  revalidate();
  return { ok: true };
}

/** Move all overdue todo tasks to today. */
export async function carryOverAll(): Promise<ActionResult> {
  const { supabase, user, timezone } = await ctx();
  if (!user) return { ok: false, error: "You're not signed in." };
  const today = localDateKey(timezone);
  const { error } = await supabase
    .from("tasks")
    .update({ due_date: today })
    .eq("status", "todo")
    .lt("due_date", today);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
