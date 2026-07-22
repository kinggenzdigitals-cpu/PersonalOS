import type { Metadata } from "next";
import { BarChart3Icon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getHabitStats } from "@/lib/queries/habits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { HabitsTabs } from "@/components/habits/habits-tabs";
import { LIFE_AREA_MAP } from "@/lib/constants";
import type { LifeArea } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Habit stats" };

export default async function HabitStatsPage() {
  const profile = await requireOnboardedProfile();
  const stats = await getHabitStats(profile.timezone);

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="font-display text-2xl tracking-tight">Habits</h1>
        <HabitsTabs />
      </header>

      <Card className="shadow-card">
        <CardContent className="pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Overall consistency (30 days)
          </p>
          <p className="tnum mt-1 font-display text-4xl">{stats.overallPct}%</p>
          {stats.bestArea && (
            <p className="mt-2 text-sm text-muted-foreground">
              Strongest area:{" "}
              <span
                className="font-medium"
                style={{
                  color: LIFE_AREA_MAP[stats.bestArea.area as LifeArea]?.color,
                }}
              >
                {LIFE_AREA_MAP[stats.bestArea.area as LifeArea]?.label ??
                  stats.bestArea.area}
              </span>{" "}
              ({stats.bestArea.pct}%)
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Most missed (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.mostMissed.length === 0 ? (
            <EmptyState
              icon={BarChart3Icon}
              title="Nothing missed"
              description="Log habits for a few days to see patterns here."
            />
          ) : (
            <ul className="space-y-2">
              {stats.mostMissed.map((m) => (
                <li
                  key={m.habit.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          LIFE_AREA_MAP[m.habit.life_area].color,
                      }}
                    />
                    {m.habit.name}
                  </span>
                  <span className="tnum text-sm text-error">
                    {Math.round(m.missedRate * 100)}% missed
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
