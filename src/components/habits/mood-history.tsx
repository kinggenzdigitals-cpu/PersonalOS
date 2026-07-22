"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoodCheckIn } from "@/components/habits/mood-check-in";
import type { MoodPoint } from "@/components/habits/mood-line-chart";

const MoodLineChart = dynamic(
  () => import("@/components/habits/mood-line-chart").then((m) => m.MoodLineChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 w-full animate-pulse rounded-lg bg-secondary" />
    ),
  },
);
import { moodColor, moodEmoji, MOOD_LABEL } from "@/lib/mood";
import { cn } from "@/lib/utils";
import type { MoodEntry } from "@/lib/supabase/types";

export function MoodHistory({
  entries,
  dateKeys,
  today,
}: {
  entries: MoodEntry[];
  dateKeys: string[];
  today: string;
}) {
  const byDate = React.useMemo(
    () => new Map(entries.map((e) => [e.entry_date, e])),
    [entries],
  );
  const todayEntry = byDate.get(today) ?? null;

  const [selected, setSelected] = React.useState<string | null>(null);

  const points: MoodPoint[] = entries.map((e) => ({
    date: e.entry_date,
    mood: e.mood,
    energy: e.energy,
    stress: e.stress,
  }));

  return (
    <div className="space-y-5">
      {/* Today's check-in */}
      <Card className="shadow-card">
        <CardContent className="flex items-center justify-between gap-3 pt-6">
          {todayEntry ? (
            <div className="flex items-center gap-3">
              <span className="text-3xl">{moodEmoji(todayEntry.mood)}</span>
              <div>
                <p className="font-medium">Today: {MOOD_LABEL[todayEntry.mood]}</p>
                <p className="text-xs text-muted-foreground">
                  Energy {todayEntry.energy ?? "–"}/5 · Stress{" "}
                  {todayEntry.stress ?? "–"}/5
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t checked in today.
            </p>
          )}
          <MoodCheckIn
            entryDate={today}
            initial={todayEntry}
            trigger={
              <Button variant={todayEntry ? "outline" : "default"} size="sm">
                {todayEntry ? "Update" : "Check in"}
              </Button>
            }
          />
        </CardContent>
      </Card>

      {/* Calendar strip */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-10 gap-1.5">
            {dateKeys.map((key) => {
              const entry = byDate.get(key) ?? null;
              const isToday = key === today;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  title={`${key}${entry ? `: ${MOOD_LABEL[entry.mood]}` : ""}`}
                  className={cn(
                    "aspect-square rounded-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isToday && "ring-2 ring-brand/50",
                  )}
                  style={{ backgroundColor: moodColor(entry?.mood) }}
                  aria-label={`${key}${entry ? `, ${MOOD_LABEL[entry.mood]}` : ", no entry"}`}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Trend */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Mood, energy & stress</CardTitle>
        </CardHeader>
        <CardContent>
          <MoodLineChart data={points} />
        </CardContent>
      </Card>

      {/* Selected-day sheet (read + edit) */}
      {selected && (
        <MoodCheckIn
          entryDate={selected}
          initial={byDate.get(selected) ?? null}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
        />
      )}
    </div>
  );
}
