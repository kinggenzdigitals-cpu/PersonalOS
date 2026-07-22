import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/date";
import type { MoodEntry } from "@/lib/supabase/types";

export async function getTodayMood(
  timezone: string,
): Promise<MoodEntry | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mood_entries")
    .select("*")
    .eq("entry_date", localDateKey(timezone))
    .maybeSingle<MoodEntry>();
  return data ?? null;
}

export async function getMoodHistory(
  timezone: string,
  days = 30,
): Promise<MoodEntry[]> {
  const supabase = await createClient();
  const today = localDateKey(timezone);
  const since = format(
    addDays(new Date(`${today}T12:00:00`), -(days - 1)),
    "yyyy-MM-dd",
  );
  const { data } = await supabase
    .from("mood_entries")
    .select("*")
    .gte("entry_date", since)
    .order("entry_date", { ascending: true })
    .returns<MoodEntry[]>();
  return data ?? [];
}
