import { fromZonedTime } from "date-fns-tz";
import { localDateKey } from "@/lib/date";

const MONTH_START_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;

export function isMonthStart(value: string): boolean {
  return MONTH_START_RE.test(value);
}

export function currentMonthStart(timezone: string): string {
  return `${localDateKey(timezone).slice(0, 7)}-01`;
}

export function resolveMonthStart(
  value: string | undefined,
  timezone: string,
): string {
  return value && isMonthStart(value) ? value : currentMonthStart(timezone);
}

export function shiftMonthStart(monthStart: string, offset: number): string {
  const [year, month] = monthStart.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function monthLabel(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function daysInMonthKey(monthStart: string): number {
  const [year, month] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthDateRange(timezone: string, monthStart: string) {
  const days = daysInMonthKey(monthStart);
  const monthEnd = `${monthStart.slice(0, 8)}${String(days).padStart(2, "0")}`;
  return {
    start: fromZonedTime(`${monthStart}T00:00:00`, timezone).toISOString(),
    end: fromZonedTime(`${monthEnd}T23:59:59.999`, timezone).toISOString(),
    endKey: monthEnd,
  };
}
