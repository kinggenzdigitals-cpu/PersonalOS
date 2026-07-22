import { cn } from "@/lib/utils";
import type { HabitStatus } from "@/lib/supabase/types";

type Day = { date: string; status: HabitStatus | null; scheduled: boolean };

const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

function cellStyle(day: Day, color: string, today: string) {
  const isToday = day.date === today;
  const base = "aspect-square rounded-md text-[10px] flex items-center justify-center";
  if (day.status === "completed")
    return {
      className: cn(base, "text-primary-foreground font-medium"),
      style: { backgroundColor: color },
    };
  if (day.status === "missed")
    return {
      className: cn(base, "bg-error/20 text-error"),
      style: undefined,
    };
  if (day.status === "skipped")
    return {
      className: cn(base, "bg-muted text-muted-foreground"),
      style: undefined,
    };
  return {
    className: cn(
      base,
      day.scheduled ? "bg-secondary text-muted-foreground" : "text-muted-foreground/40",
      isToday && "ring-2 ring-brand/50",
    ),
    style: undefined,
  };
}

export function HabitHeatmap({
  month,
  color,
  today,
}: {
  month: Day[];
  color: string;
  today: string;
}) {
  if (month.length === 0) return null;
  const firstWeekday = new Date(`${month[0].date}T12:00:00`).getDay();
  const pad = Array.from({ length: firstWeekday });

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {WEEKDAY_HEADERS.map((h, i) => (
          <span key={i}>{h}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {pad.map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {month.map((day) => {
          const { className, style } = cellStyle(day, color, today);
          const dayNum = Number(day.date.slice(-2));
          return (
            <span
              key={day.date}
              className={className}
              style={style}
              title={`${day.date}: ${day.status ?? (day.scheduled ? "not logged" : "not scheduled")}`}
            >
              {dayNum}
            </span>
          );
        })}
      </div>
    </div>
  );
}
