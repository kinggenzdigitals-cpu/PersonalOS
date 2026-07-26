"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FocusSessionType } from "@/lib/supabase/types";

export type RecordFocusInput = {
  sessionType: FocusSessionType;
  taskId: string | null;
  habitId: string | null;
  plannedMinutes: number;
  actualSeconds: number;
  completed: boolean;
  startedAt: string; // ISO
};

/**
 * Persist a finished focus/break session. Best-effort: if the migration hasn't
 * been applied yet the insert fails silently so the timer keeps working.
 */
export async function recordFocusSession(
  input: RecordFocusInput,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase.from("focus_sessions").insert({
    user_id: user.id,
    session_type: input.sessionType,
    task_id: input.taskId,
    habit_id: input.habitId,
    planned_minutes: Math.max(0, Math.round(input.plannedMinutes)),
    actual_seconds: Math.max(0, Math.round(input.actualSeconds)),
    completed: input.completed,
    started_at: input.startedAt,
    completed_at: input.completed ? new Date().toISOString() : null,
  });
  if (error) return { ok: false };

  revalidatePath("/focus");
  revalidatePath("/home");
  return { ok: true };
}
