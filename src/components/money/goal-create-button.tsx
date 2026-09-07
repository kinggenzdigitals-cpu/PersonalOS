"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { GoalForm } from "@/components/money/goal-form";

export function GoalCreateButton({ empty = false }: { empty?: boolean }) {
  return (
    <FormSheet
      title="New goal"
      trigger={
        <Button variant={empty ? "default" : "outline"} className={empty ? undefined : "w-full"}>
          <PlusIcon className="size-4" /> Add goal
        </Button>
      }
    >
      {(close) => <GoalForm onDone={close} />}
    </FormSheet>
  );
}
