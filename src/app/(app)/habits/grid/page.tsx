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

      <HabitGrid initial={grid} />
    </div>
  );
}
