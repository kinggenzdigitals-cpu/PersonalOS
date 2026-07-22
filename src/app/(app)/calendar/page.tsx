import type { Metadata } from "next";
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { requireOnboardedProfile } from "@/lib/auth";
import { getCalendarRange } from "@/lib/queries/calendar";
import { localToday } from "@/lib/queries/habits";
import { localDateKey } from "@/lib/date";
import { CalendarView } from "@/components/calendar/calendar-view";
import { AddEventButton } from "@/components/calendar/add-event-button";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const profile = await requireOnboardedProfile();
  const weekStartsOn: 0 | 1 = profile.week_starts_on === "sunday" ? 0 : 1;
  const anchor = localToday(profile.timezone);
  const today = localDateKey(profile.timezone);

  // Initial data must match the client's default (month view of today).
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn });
  const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn });
  const initial = await getCalendarRange(
    format(gridStart, "yyyy-MM-dd"),
    format(gridEnd, "yyyy-MM-dd"),
    profile.timezone,
  );

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl tracking-tight">Calendar</h1>
      </header>

      <CalendarView
        initial={initial}
        timezone={profile.timezone}
        weekStartsOn={weekStartsOn}
        today={today}
      />

      <AddEventButton />
    </div>
  );
}
