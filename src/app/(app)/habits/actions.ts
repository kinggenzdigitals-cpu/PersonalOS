"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkCap } from "@/lib/plan-guard";
import { nextStatus } from "@/lib/habits";
import { getHabitsBoard, type HabitBoardItem } from "@/lib/queries/habits";
import type { HabitStatus, LifeArea } from "@/lib/supabase/types";

/** Fresh habit board (with recomputed streaks) for optimistic UIs. */
export async function refreshHabitsBoard(): Promise<HabitBoardItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .single<{ timezone: string }>();
  return getHabitsBoard(profile?.timezone ?? "Asia/Manila");
}

export type ActionResult =
  | { ok: true; status?: HabitStatus | null; id?: string }
  | { ok: false; error: string };

async function auth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidate() {
  revalidatePath("/", "layout");
}

// ---- Habit CRUD ----------------------------------------------------------

export type HabitInput = {
  name: string;
  life_area: LifeArea;
  schedule_days: number[];
  reminder_time: string | null;
};

export async function upsertHabit(
  input: HabitInput & { id?: string },
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.name.trim()) return { ok: false, error: "Name the habit." };

  const row = {
    name: input.name.trim(),
    life_area: input.life_area,
    schedule_days: input.schedule_days,
    reminder_time: input.reminder_time,
  };

  if (input.id) {
    const { error } = await supabase
      .from("habits")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, id: input.id };
  }

  const { count } = await supabase
    .from("habits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: activeCount } = await supabase
    .from("habits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);
  const capError = await checkCap("habits", activeCount ?? 0);
  if (capError) return { ok: false, error: capError };

  const { data, error } = await supabase
    .from("habits")
    .insert({ user_id: user.id, sort_order: count ?? 0, ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function setHabitArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase
    .from("habits")
    .update({ active: !archived })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteHabit(id: string): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// ---- Logging -------------------------------------------------------------

/** Cycle a habit's status for a date: none → completed → skipped → missed → none. */
export async function cycleHabitLog(
  habitId: string,
  logDate: string,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { data: existing } = await supabase
    .from("habit_logs")
    .select("id, status")
    .eq("habit_id", habitId)
    .eq("log_date", logDate)
    .maybeSingle<{ id: string; status: HabitStatus }>();

  const next = nextStatus(existing?.status);

  if (next === null) {
    if (existing) {
      const { error } = await supabase
        .from("habit_logs")
        .delete()
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    }
    revalidate();
    return { ok: true, status: null };
  }

  const { error } = await supabase.from("habit_logs").upsert(
    {
      user_id: user.id,
      habit_id: habitId,
      log_date: logDate,
      status: next,
    },
    { onConflict: "habit_id,log_date" },
  );
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, status: next };
}

/** Directly set (or clear) a habit's status for a date. */
export async function setHabitLog(
  habitId: string,
  logDate: string,
  status: HabitStatus | null,
): Promise<ActionResult> {
  const { supabase, user } = await auth();
  if (!user) return { ok: false, error: "You're not signed in." };

  if (status === null) {
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("habit_id", habitId)
      .eq("log_date", logDate);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, status: null };
  }

  const { error } = await supabase.from("habit_logs").upsert(
    { user_id: user.id, habit_id: habitId, log_date: logDate, status },
    { onConflict: "habit_id,log_date" },
  );
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, status };
}
