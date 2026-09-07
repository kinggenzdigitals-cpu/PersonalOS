"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { GoalForm } from "@/components/money/goal-form";

export function GoalCreateButton({
  empty = false,
  todayKey,
}: {
  empty?: boolean;
  /** Today as YYYY-MM-DD in the user's timezone — enables the sinking-fund
   *  "set aside X/month" hint when a target date is entered. */
  todayKey?: string;
}) {
  return (
    <FormSheet
      title="New goal"
      trigger={
        <Button variant={empty ? "default" : "outline"} className={empty ? undefined : "w-full"}>
          <PlusIcon className="size-4" /> Add goal
        </Button>
      }
    >
      {(close) => <GoalForm onDone={close} todayKey={todayKey} />}
    </FormSheet>
  );
}
