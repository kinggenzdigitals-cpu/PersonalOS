"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { friendlyDbError } from "@/lib/supabase/errors";
import { normalizeFocusSettings, type FocusTimerSettings } from "@/lib/focus-settings";
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  const active = await requireActiveUser();
  if (!active) return { ok: false, error: "You're not signed in." };
  const { supabase, user } = active;

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
  if (error) {
    const missingTable = error.code === "42P01";
    return {
      ok: false,
      error: missingTable
        ? "Focus sessions are not ready yet. Apply the latest Supabase migrations."
        : friendlyDbError(error, "Couldn't save this focus session."),
    };
  }

  revalidatePath("/focus");
  revalidatePath("/home");
  return { ok: true };
}


export async function saveFocusSettings(
  settings: FocusTimerSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const active = await requireActiveUser();
  if (!active) return { ok: false, error: "You're not signed in." };
  const { supabase, user } = active;

  const normalized = normalizeFocusSettings(settings);
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    focus_settings: normalized,
  });

  if (error) {
    const missingTable = error.code === "42P01";
    return {
      ok: false,
      error: missingTable
        ? "Focus settings sync is not ready yet. Apply the latest Supabase migrations."
        : friendlyDbError(error, "Couldn't save your focus settings."),
    };
  }

  revalidatePath("/focus");
  return { ok: true };
}
