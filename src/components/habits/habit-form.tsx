"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LIFE_AREAS, WEEKDAYS } from "@/lib/constants";
import { upsertHabit, deleteHabit } from "@/app/(app)/habits/actions";
import type { Habit, LifeArea } from "@/lib/supabase/types";
import { toast } from "sonner";

export function HabitForm({
  initial,
  onDone,
}: {
  initial?: Habit;
  onDone: () => void;
}) {
  const router = useRouter();
  const editing = Boolean(initial);

  const [name, setName] = React.useState(initial?.name ?? "");
  const [lifeArea, setLifeArea] = React.useState<LifeArea>(
    initial?.life_area ?? "physical",
  );
  const [days, setDays] = React.useState<number[]>(initial?.schedule_days ?? []);
  const [reminder, setReminder] = React.useState(
    initial?.reminder_time?.slice(0, 5) ?? "",
  );
  const [saving, setSaving] = React.useState(false);

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  async function save() {
    if (!name.trim()) return toast.error("Name the habit.");
    setSaving(true);
    const result = await upsertHabit({
      id: initial?.id,
      name,
      life_area: lifeArea,
      schedule_days: days,
      reminder_time: reminder ? `${reminder}:00` : null,
    });
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(editing ? "Habit updated" : "Habit added");
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    const result = await deleteHabit(initial.id);
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Habit removed");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="habit-name">Name</Label>
        <Input
          id="habit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Morning walk"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label>Life area</Label>
        <Select
          value={lifeArea}
          onValueChange={(v) => setLifeArea(v as LifeArea)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIFE_AREAS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  {a.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Days</Label>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w) => {
            const active = days.includes(w.value);
            return (
              <button
                key={w.value}
                type="button"
                onClick={() => toggleDay(w.value)}
                aria-pressed={active}
                className={cn(
                  "size-9 rounded-full text-xs font-medium transition-colors",
                  active
                    ? "bg-brand text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {w.short.charAt(0)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {days.length === 0 ? "Every day" : `${days.length} days a week`}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="habit-reminder">Reminder (optional, in-app)</Label>
        <Input
          id="habit-reminder"
          type="time"
          value={reminder}
          onChange={(e) => setReminder(e.target.value)}
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
          {editing ? "Save changes" : "Add habit"}
        </Button>
      </div>
    </div>
  );
}
