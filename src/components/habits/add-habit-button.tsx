"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { HabitForm } from "@/components/habits/habit-form";

export function AddHabitButton({
  variant = "outline",
}: {
  variant?: "outline" | "default";
}) {
  return (
    <FormSheet
      title="New habit"
      trigger={
        <Button variant={variant} className="w-full">
          <PlusIcon className="size-4" /> Add habit
        </Button>
      }
    >
      {(close) => <HabitForm onDone={close} />}
    </FormSheet>
  );
}
