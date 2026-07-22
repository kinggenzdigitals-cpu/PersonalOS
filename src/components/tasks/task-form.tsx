"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useProfile } from "@/components/providers/profile-provider";
import { localDateKey } from "@/lib/date";
import {
  createTask,
  updateTask,
  deleteTask,
} from "@/app/(app)/tasks/actions";
import type { Task } from "@/lib/supabase/types";
import { toast } from "sonner";

export function TaskForm({
  initial,
  defaultPriority = false,
  onDone,
}: {
  initial?: Task;
  defaultPriority?: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const profile = useProfile();
  const editing = Boolean(initial);

  const today = localDateKey(profile.timezone);
  const tomorrow = format(
    addDays(new Date(`${today}T12:00:00`), 1),
    "yyyy-MM-dd",
  );

  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [due, setDue] = React.useState<string | null>(initial?.due_date ?? today);
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [makePriority, setMakePriority] = React.useState(defaultPriority);
  const [saving, setSaving] = React.useState(false);

  const chips: { label: string; value: string | null }[] = [
    { label: "Today", value: today },
    { label: "Tomorrow", value: tomorrow },
    { label: "None", value: null },
  ];

  const usingPickDate = due !== null && due !== today && due !== tomorrow;

  async function save() {
    if (!title.trim()) return toast.error("Give the task a title.");
    setSaving(true);
    const result = editing
      ? await updateTask(initial!.id, { title, dueDate: due, notes })
      : await createTask({ title, dueDate: due, notes, makePriority });

    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(editing ? "Task updated" : "Task added");
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    const result = await deleteTask(initial.id);
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Task deleted");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="task-title">Task</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label>Due</Label>
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setDue(c.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                (due === c.value || (c.value === null && due === null)) &&
                  !usingPickDate
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/40",
              )}
            >
              {c.label}
            </button>
          ))}
          <Input
            type="date"
            value={usingPickDate && due ? due : ""}
            onChange={(e) => setDue(e.target.value || null)}
            className={cn(
              "h-9 w-auto",
              usingPickDate && "border-brand text-brand",
            )}
            aria-label="Pick a date"
          />
        </div>
      </div>

      {!editing && (
        <label className="flex items-center justify-between gap-2">
          <span className="text-sm">
            Make it a top-3 for today
            <span className="block text-xs text-muted-foreground">
              Up to 3 priorities per day.
            </span>
          </span>
          <Switch checked={makePriority} onCheckedChange={setMakePriority} />
        </label>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="task-notes">Notes</Label>
        <Textarea
          id="task-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
          rows={2}
        />
      </div>

      <div className="flex gap-2 pt-2">
        {editing && (
          <Button
            type="button"
            variant="ghost"
            className="text-error hover:text-error"
            onClick={remove}
            disabled={saving}
          >
            <Trash2Icon className="size-4" />
          </Button>
        )}
        <Button className="flex-1" onClick={save} disabled={saving}>
          {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
          {editing ? "Save changes" : "Add task"}
        </Button>
      </div>
    </div>
  );
}
