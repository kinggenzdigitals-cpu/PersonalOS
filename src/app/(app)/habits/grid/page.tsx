import type { Metadata } from "next";
import { requireOnboardedProfile } from "@/lib/auth";
import { getHabitGrid } from "@/lib/queries/habits";
import { HabitsTabs } from "@/components/habits/habits-tabs";
import { HabitGrid } from "@/components/habits/habit-grid";

export const metadata: Metadata = { title: "Habit grid" };

export default async function HabitGridPage() {
  const profile = await requireOnboardedProfile();
  const grid = await getHabitGrid(profile.timezone);

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="font-display text-2xl tracking-tight">Habits</h1>
        <HabitsTabs />
      </header>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">{grid.monthLabel}</h2>
        <p className="text-xs text-muted-foreground">
          Tap a day to mark it done
        </p>
      </div>

      {/* Break out of the narrow content column on desktop so the whole month
          fits without scrolling. Centered within the content area (viewport
          minus the 15rem sidebar). On mobile it stays in-flow and scrolls. */}
      <div className="md:w-[calc(100vw_-_15rem_-_2rem)] md:mx-[calc((100%_-_(100vw_-_15rem_-_2rem))_/_2)]">
        <HabitGrid initial={grid} />
      </div>
    </div>
  );
}
