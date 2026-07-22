"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/date";
import type { MoodEntry } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Today's mood entry (in the user's timezone), or null. */
export async function getTodayMoodAction(): Promise<MoodEntry | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .single<{ timezone: string }>();
  const { data } = await supabase
    .from("mood_entries")
    .select("*")
    .eq("entry_date", localDateKey(profile?.timezone ?? "Asia/Manila"))
    .maybeSingle<MoodEntry>();
  return data ?? null;
}

export type MoodInput = {
  entryDate: string; // YYYY-MM-DD
  mood: number;
  energy: number | null;
  stress: number | null;
  gratitude?: string | null;
  wins?: string | null;
  struggles?: string | null;
  prayerRequests?: string | null;
  journal?: string | null;
};

export async function upsertMoodEntry(
  input: MoodInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(input.mood >= 1 && input.mood <= 5)) {
    return { ok: false, error: "Pick how you're feeling." };
  }

  const { error } = await supabase.from("mood_entries").upsert(
    {
      user_id: user.id,
      entry_date: input.entryDate,
      mood: input.mood,
      energy: input.energy,
      stress: input.stress,
      gratitude: input.gratitude?.trim() || null,
      wins: input.wins?.trim() || null,
      struggles: input.struggles?.trim() || null,
      prayer_requests: input.prayerRequests?.trim() || null,
      journal: input.journal?.trim() || null,
    },
    { onConflict: "user_id,entry_date" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
