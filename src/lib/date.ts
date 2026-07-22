import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

/** "Now" as seen in the user's timezone. */
export function zonedNow(timezone: string) {
  return toZonedTime(new Date(), timezone);
}

/** UTC ISO boundaries for the current calendar month in the user's timezone. */
export function monthRange(timezone: string, ref?: Date) {
  const local = ref ? toZonedTime(ref, timezone) : zonedNow(timezone);
  return {
    start: fromZonedTime(startOfMonth(local), timezone).toISOString(),
    end: fromZonedTime(endOfMonth(local), timezone).toISOString(),
  };
}

/** UTC ISO boundaries for "today" in the user's timezone. */
export function dayRange(timezone: string, ref?: Date) {
  const local = ref ? toZonedTime(ref, timezone) : zonedNow(timezone);
  return {
    start: fromZonedTime(startOfDay(local), timezone).toISOString(),
    end: fromZonedTime(endOfDay(local), timezone).toISOString(),
  };
}

/** UTC ISO boundaries for the current week in the user's timezone. */
export function weekRange(
  timezone: string,
  weekStartsOn: 0 | 1 = 1,
  ref?: Date,
) {
  const local = ref ? toZonedTime(ref, timezone) : zonedNow(timezone);
  return {
    start: fromZonedTime(startOfWeek(local, { weekStartsOn }), timezone).toISOString(),
    end: fromZonedTime(endOfWeek(local, { weekStartsOn }), timezone).toISOString(),
  };
}

/** The user's local date as a YYYY-MM-DD string (for `date` columns). */
export function localDateKey(timezone: string, ref?: Date) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(ref ?? new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(ref ?? new Date());
  }
}
