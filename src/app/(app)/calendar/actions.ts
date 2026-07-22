"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCalendarRange, type CalendarData } from "@/lib/queries/calendar";
import type { CalendarEventKind } from "@/lib/supabase/types";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let timezone = "Asia/Manila";
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("user_id", user.id)
      .single<{ timezone: string }>();
    timezone = data?.timezone ?? timezone;
  }
  return { supabase, user, timezone };
}

function revalidate() {
  revalidatePath("/", "layout");
}

export type EventInput = {
  title: string;
  kind: CalendarEventKind;
  startAt: string; // ISO
  endAt: string | null;
  allDay: boolean;
  location?: string | null;
  notes?: string | null;
};

export async function upsertEvent(
  input: EventInput & { id?: string },
): Promise<ActionResult> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!input.title.trim()) return { ok: false, error: "Name the event." };
  if (!input.startAt) return { ok: false, error: "Pick a start time." };

  const row = {
    title: input.title.trim(),
    kind: input.kind,
    start_at: input.startAt,
    end_at: input.endAt,
    all_day: input.allDay,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("calendar_events")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({ user_id: user.id, ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: "You're not signed in." };
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Fetch calendar data for a visible range (client navigation). */
export async function fetchCalendarRange(
  fromKey: string,
  toKey: string,
): Promise<CalendarData> {
  const { timezone } = await ctx();
  return getCalendarRange(fromKey, toKey, timezone);
}
