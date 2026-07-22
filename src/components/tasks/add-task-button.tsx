"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { TaskForm } from "@/components/tasks/task-form";

export function AddTaskButton({
  variant = "outline",
  defaultPriority = false,
  label = "Add task",
}: {
  variant?: "outline" | "default";
  defaultPriority?: boolean;
  label?: string;
}) {
  return (
    <FormSheet
      title="New task"
      trigger={
        <Button variant={variant} className="w-full">
          <PlusIcon className="size-4" /> {label}
        </Button>
      }
    >
      {(close) => <TaskForm defaultPriority={defaultPriority} onDone={close} />}
    </FormSheet>
  );
}
