"use client";

import { Settings2Icon } from "lucide-react";
import { FormSheet } from "@/components/money/form-sheet";
import { HabitForm } from "@/components/habits/habit-form";
import type { Habit } from "@/lib/supabase/types";

export function EditHabitButton({ habit }: { habit: Habit }) {
  return (
    <FormSheet
      title="Edit habit"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Settings2Icon className="size-4" /> Edit
        </button>
      }
    >
      {(close) => <HabitForm initial={habit} onDone={close} />}
    </FormSheet>
  );
}
