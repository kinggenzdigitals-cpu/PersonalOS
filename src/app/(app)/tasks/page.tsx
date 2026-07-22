import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon, ListTodoIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getTasksByView, type TaskView } from "@/lib/queries/tasks";
import { EmptyState } from "@/components/ui/empty-state";
import { TasksTabs } from "@/components/tasks/tasks-tabs";
import { TaskRow } from "@/components/tasks/task-row";
import { AddTaskButton } from "@/components/tasks/add-task-button";

export const metadata: Metadata = { title: "Tasks" };

const EMPTY: Record<TaskView, string> = {
  today: "Nothing due today. Add a task or enjoy the calm.",
  upcoming: "No upcoming tasks scheduled.",
  backlog: "Your backlog is empty.",
  done: "Completed tasks will show up here.",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const profile = await requireOnboardedProfile();
  const { view: viewParam } = await searchParams;
  const view = (["today", "upcoming", "backlog", "done"] as const).includes(
    viewParam as TaskView,
  )
    ? (viewParam as TaskView)
    : "today";

  const tasks = await getTasksByView(view, profile.timezone);

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" /> Home
        </Link>
        <h1 className="font-display text-2xl tracking-tight">Tasks</h1>
        <TasksTabs />
      </header>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodoIcon}
          title="All clear"
          description={EMPTY[view]}
          className="py-10"
          action={view !== "done" ? <AddTaskButton /> : undefined}
        />
      ) : (
        <>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-soft">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
          {view !== "done" && <AddTaskButton />}
        </>
      )}
    </div>
  );
}
