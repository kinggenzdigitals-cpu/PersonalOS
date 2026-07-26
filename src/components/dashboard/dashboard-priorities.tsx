"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TargetIcon, PencilIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { AddTaskButton } from "@/components/tasks/add-task-button";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "@/app/(app)/tasks/actions";
import { setTodayPriorities } from "@/app/(app)/tasks/actions";
import type { Task } from "@/lib/supabase/types";
import { toast } from "sonner";

export function DashboardPriorities({
  priorities,
  candidates,
}: {
  priorities: Task[];
  candidates: Task[];
}) {
  const router = useRouter();
  const [picking, setPicking] = React.useState(false);

  async function toggleDone(task: Task, done: boolean) {
    const res = await setTaskStatus(task.id, done ? "done" : "todo");
    if (!res.ok) toast.error(res.error);
    else router.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Top 3 priorities</h2>
        {priorities.length > 0 && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <PencilIcon className="size-3.5" /> Edit
          </button>
        )}
      </div>

      {priorities.length === 0 ? (
        <EmptyState
          icon={TargetIcon}
          title="Pick today's top 3"
          description="Choose the three things that matter most today."
          action={
            <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
              Pick priorities
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          {priorities.map((task) => {
            const done = task.status === "done";
            return (
              <div key={task.id} className="flex items-center gap-3 px-3 py-2.5">
                <Checkbox
                  checked={done}
                  onCheckedChange={(v) => toggleDone(task, Boolean(v))}
                  aria-label={done ? "Mark not done" : "Mark done"}
                />
                <span
                  className={cn(
                    "flex-1 text-sm",
                    done && "text-muted-foreground line-through",
                  )}
                >
                  {task.title}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <PriorityPicker
        key={picking ? "picker-open" : "picker-closed"}
        open={picking}
        onOpenChange={setPicking}
        candidates={candidates}
        current={priorities}
      />
    </section>
  );
}

function PriorityPicker({
  open,
  onOpenChange,
  candidates,
  current,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidates: Task[];
  current: Task[];
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(current.map((t) => t.id)),
  );
  const [saving, setSaving] = React.useState(false);

  // Merge current priorities into the candidate list (dedup).
  const list = React.useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of [...current, ...candidates]) map.set(t.id, t);
    return [...map.values()];
  }, [current, candidates]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= 3) {
          toast.error("Pick at most 3. Deselect one to swap.");
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const res = await setTodayPriorities([...selected]);
    if (!res.ok) {
      toast.error(res.error);
      setSaving(false);
      return;
    }
    onOpenChange(false);
    router.refresh();
    toast.success("Priorities updated");
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[520px]">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <DialogTitle className="font-display">Pick today&apos;s top 3</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pt-2">
          {list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No open tasks yet. Add one below.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {list.map((task) => {
                const checked = selected.has(task.id);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => toggle(task.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
                    >
                      <Checkbox checked={checked} className="pointer-events-none" />
                      <span className="flex-1 text-sm">{task.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {selected.size}/3 selected
          </p>

          <AddTaskButton defaultPriority label="New priority task" />

          <Button className="w-full" onClick={save} disabled={saving}>
            {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
            Save priorities
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
