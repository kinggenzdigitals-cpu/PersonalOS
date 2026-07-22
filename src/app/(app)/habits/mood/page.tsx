import type { Metadata } from "next";
import { addDays, format } from "date-fns";
import { requireOnboardedProfile } from "@/lib/auth";
import { getTodayMood, getMoodHistory } from "@/lib/queries/mood";
import { localDateKey } from "@/lib/date";
import { HabitsTabs } from "@/components/habits/habits-tabs";
import { MoodHistory } from "@/components/habits/mood-history";

export const metadata: Metadata = { title: "Mood" };

export default async function MoodPage() {
  const profile = await requireOnboardedProfile();
  const today = localDateKey(profile.timezone);

  const [todayMood, history] = await Promise.all([
    getTodayMood(profile.timezone),
    getMoodHistory(profile.timezone, 30),
  ]);

  // last 30 day keys (oldest → newest), including today
  const base = new Date(`${today}T12:00:00`);
  const dateKeys = Array.from({ length: 30 }, (_, i) =>
    format(addDays(base, -(29 - i)), "yyyy-MM-dd"),
  );

  // Ensure today's entry is present in the set passed down.
  const entries = todayMood
    ? [...history.filter((h) => h.entry_date !== today), todayMood].sort((a, b) =>
        a.entry_date.localeCompare(b.entry_date),
      )
    : history;

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="font-display text-2xl tracking-tight">Habits</h1>
        <HabitsTabs />
      </header>

      <MoodHistory entries={entries} dateKeys={dateKeys} today={today} />
    </div>
  );
}
