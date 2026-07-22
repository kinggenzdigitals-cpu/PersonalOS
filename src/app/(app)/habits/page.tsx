import type { Metadata } from "next";
import { SparklesIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getHabitsBoard, localToday } from "@/lib/queries/habits";
import { format } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";
import { HabitsTabs } from "@/components/habits/habits-tabs";
import { HabitsBoard } from "@/components/habits/habits-board";
import { AddHabitButton } from "@/components/habits/add-habit-button";

export const metadata: Metadata = { title: "Habits" };

export default async function HabitsPage() {
  const profile = await requireOnboardedProfile();
  const board = await getHabitsBoard(profile.timezone);
  const today = format(localToday(profile.timezone), "yyyy-MM-dd");

  const boardKey = board
    .map((i) => `${i.habit.id}:${i.habit.updated_at}`)
    .join("|");

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="font-display text-2xl tracking-tight">Habits</h1>
        <HabitsTabs />
      </header>

      {board.length === 0 ? (
        <EmptyState
          icon={SparklesIcon}
          title="No habits yet"
          description="Add a habit and tap it each day to build a streak."
          className="py-10"
          action={<AddHabitButton variant="default" />}
        />
      ) : (
        <>
          <HabitsBoard key={boardKey} initial={board} today={today} />
          <AddHabitButton />
        </>
      )}
    </div>
  );
}
