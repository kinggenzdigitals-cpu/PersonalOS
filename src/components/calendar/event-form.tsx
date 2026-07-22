"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/components/providers/profile-provider";
import { localDateKey } from "@/lib/date";
import { upsertEvent, deleteEvent } from "@/app/(app)/calendar/actions";
import type { CalendarEvent, CalendarEventKind } from "@/lib/supabase/types";
import { toast } from "sonner";

const KINDS: { value: CalendarEventKind; label: string }[] = [
  { value: "appointment", label: "Appointment" },
  { value: "personal", label: "Personal" },
  { value: "work", label: "Work" },
  { value: "other", label: "Other" },
];

function toDateInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function toTimeInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(11, 16);
}

export function EventForm({
  initial,
  defaultDate,
  onDone,
}: {
  initial?: CalendarEvent;
  defaultDate?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const profile = useProfile();
  const editing = Boolean(initial);

  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [kind, setKind] = React.useState<CalendarEventKind>(
    initial?.kind ?? "appointment",
  );
  const [allDay, setAllDay] = React.useState(initial?.all_day ?? false);
  const [date, setDate] = React.useState(
    initial
      ? toDateInput(initial.start_at)
      : (defaultDate ?? localDateKey(profile.timezone)),
  );
  const [startTime, setStartTime] = React.useState(
    initial && !initial.all_day ? toTimeInput(initial.start_at) : "09:00",
  );
  const [endTime, setEndTime] = React.useState(
    initial?.end_at ? toTimeInput(initial.end_at) : "",
  );
  const [location, setLocation] = React.useState(initial?.location ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!title.trim()) return toast.error("Name the event.");
    const startAt = allDay
      ? new Date(`${date}T00:00:00`).toISOString()
      : new Date(`${date}T${startTime}`).toISOString();
    const endAt =
      !allDay && endTime ? new Date(`${date}T${endTime}`).toISOString() : null;

    setSaving(true);
    const result = await upsertEvent({
      id: initial?.id,
      title,
      kind,
      startAt,
      endAt,
      allDay,
      location,
      notes,
    });
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(editing ? "Event updated" : "Event added");
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    const result = await deleteEvent(initial.id);
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Event deleted");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="event-title">Title</Label>
        <Input
          id="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Dentist appointment"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as CalendarEventKind)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">All day</span>
        <Switch checked={allDay} onCheckedChange={setAllDay} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="event-date">Date</Label>
          <Input
            id="event-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {!allDay && (
          <div className="space-y-1.5">
            <Label htmlFor="event-start">Start</Label>
            <Input
              id="event-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        )}
      </div>

      {!allDay && (
        <div className="space-y-1.5">
          <Label htmlFor="event-end">End (optional)</Label>
          <Input
            id="event-end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="event-location">Location</Label>
        <Input
          id="event-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-notes">Notes</Label>
        <Textarea
          id="event-notes"
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
          {editing ? "Save changes" : "Add event"}
        </Button>
      </div>
    </div>
  );
}
