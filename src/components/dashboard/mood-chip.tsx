"use client";

import { MoodCheckIn } from "@/components/habits/mood-check-in";
import { moodEmoji, MOOD_LABEL } from "@/lib/mood";
import type { MoodEntry } from "@/lib/supabase/types";

export function MoodChip({
  today,
  entry,
}: {
  today: string;
  entry: MoodEntry | null;
}) {
  return (
    <MoodCheckIn
      entryDate={today}
      initial={entry}
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm shadow-soft transition-colors hover:border-brand/40"
        >
          {entry ? (
            <>
              <span className="text-base leading-none">
                {moodEmoji(entry.mood)}
              </span>
              <span className="text-muted-foreground">
                {MOOD_LABEL[entry.mood]}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">How are you? →</span>
          )}
        </button>
      }
    />
  );
}
