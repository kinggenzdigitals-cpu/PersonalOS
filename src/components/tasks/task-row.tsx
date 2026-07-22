"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MoreVerticalIcon,
  CalendarClockIcon,
  ArchiveIcon,
  XCircleIcon,
  Trash2Icon,
  RotateCcwIcon,
  StarIcon,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormSheet } from "@/components/money/form-sheet";
import { TaskForm } from "@/components/tasks/task-form";
import { cn } from "@/lib/utils";
import { useProfile } from "@/components/providers/profile-provider";
import { localDateKey } from "@/lib/date";
import {
  setTaskStatus,
  moveTask,
  deleteTask,
} from "@/app/(app)/tasks/actions";
import type { Task } from "@/lib/supabase/types";
import { toast } from "sonner";

function dueLabel(due: string | null, today: string) {
  if (!due) return null;
  const d = new Date(`${due}T12:00:00`);
  if (due < today) return { text: `${due}`, overdue: true };
  if (due === today) return { text: "Today", overdue: false };
  return {
    text: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    overdue: false,
  };
}

export function TaskRow({ task }: { task: Task }) {
  const router = useRouter();
  const profile = useProfile();
  const [busy, setBusy] = React.useState(false);
  const today = localDateKey(profile.timezone);
  const done = task.status === "done";
  const cancelled = task.status === "cancelled";
  const due = dueLabel(task.due_date, today);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    if (!res.ok && res.error) toast.error(res.error);
    else router.refresh();
    setBusy(false);
  }

  const tomorrow = format(
    addDays(new Date(`${today}T12:00:00`), 1),
    "yyyy-MM-dd",
  );

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {!cancelled && (
        <Checkbox
          checked={done}
          disabled={busy}
          onCheckedChange={(v) =>
            run(() => setTaskStatus(task.id, v ? "done" : "todo"))
          }
          aria-label={done ? "Mark not done" : "Mark done"}
        />
      )}

      <FormSheet
        title="Edit task"
        trigger={
          <button
            type="button"
            className="min-w-0 flex-1 text-left focus-visible:outline-none"
          >
            <span
              className={cn(
                "block truncate text-sm",
                (done || cancelled) && "text-muted-foreground line-through",
              )}
            >
              {task.title}
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              {task.is_priority && (
                <span className="inline-flex items-center gap-0.5 text-brand">
                  <StarIcon className="size-3 fill-current" /> Top 3
                </span>
              )}
              {due && (
                <span className={cn(due.overdue && "text-error")}>
                  {due.text}
                </span>
              )}
            </span>
          </button>
        }
      >
        {(close) => <TaskForm initial={task} onDone={close} />}
      </FormSheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy}
            aria-label="Task actions"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreVerticalIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {(done || cancelled) && (
            <DropdownMenuItem
              onClick={() => run(() => setTaskStatus(task.id, "todo"))}
            >
              <RotateCcwIcon className="size-4" /> Reopen
            </DropdownMenuItem>
          )}
          {!done && !cancelled && (
            <>
              <DropdownMenuItem
                onClick={() => run(() => moveTask(task.id, tomorrow))}
              >
                <CalendarClockIcon className="size-4" /> Move to tomorrow
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => run(() => setTaskStatus(task.id, "backlog"))}
              >
                <ArchiveIcon className="size-4" /> Backlog
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => run(() => setTaskStatus(task.id, "cancelled"))}
              >
                <XCircleIcon className="size-4" /> Cancel
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            className="text-error focus:text-error"
            onClick={() => run(() => deleteTask(task.id))}
          >
            <Trash2Icon className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
