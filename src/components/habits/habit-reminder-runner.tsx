"use client";

import * as React from "react";

export type HabitReminder = {
  id: string;
  name: string;
  reminderTime: string;
  scheduleDays: number[];
};

function dayNumber(date: Date) {
  // Existing habit schedules store Monday as 1 through Sunday as 7.
  const native = date.getDay();
  return native === 0 ? 7 : native;
}

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function HabitReminderRunner({
  reminders,
}: {
  reminders: HabitReminder[];
}) {
  React.useEffect(() => {
    if (reminders.length === 0 || typeof Notification === "undefined") return;

    function tick() {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")}`;
      const today = dayNumber(now);
      const todayKey = dateKey(now);

      for (const reminder of reminders) {
        const scheduled =
          reminder.scheduleDays.length === 0 ||
          reminder.scheduleDays.includes(today);
        if (!scheduled || reminder.reminderTime.slice(0, 5) !== hhmm) continue;

        const storageKey = `fht-habit-reminder:${reminder.id}:${todayKey}:${hhmm}`;
        if (window.localStorage.getItem(storageKey)) continue;
        window.localStorage.setItem(storageKey, "1");
        try {
          new Notification(`Habit reminder: ${reminder.name}`, {
            body: "Time to check in and keep your streak moving.",
            tag: `habit-${reminder.id}`,
          });
        } catch {
          /* notification may be blocked by the browser */
        }
      }
    }

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [reminders]);

  return null;
}
