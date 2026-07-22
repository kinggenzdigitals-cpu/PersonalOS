"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  ExternalLinkIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildDayItems,
  daySourceCounts,
  SOURCE_META,
  type CalendarData,
  type CalItem,
  type CalendarSource,
} from "@/lib/calendar-items";
import { fetchCalendarRange } from "@/app/(app)/calendar/actions";
import { EventForm } from "@/components/calendar/event-form";
import { TaskForm } from "@/components/tasks/task-form";
import { PayBillForm } from "@/components/money/pay-bill-form";
import { setTaskStatus } from "@/app/(app)/tasks/actions";
import { toast } from "sonner";

type View = "month" | "week" | "day";
const SOURCES: CalendarSource[] = ["event", "task", "bill", "habit"];

export function CalendarView({
  initial,
  timezone,
  weekStartsOn,
  today,
}: {
  initial: CalendarData;
  timezone: string;
  weekStartsOn: 0 | 1;
  today: string;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<View>("month");
  const [anchor, setAnchor] = React.useState<Date>(
    () => new Date(`${today}T12:00:00`),
  );
  const [filters, setFilters] = React.useState<Set<CalendarSource>>(
    new Set(SOURCES),
  );
  const [data, setData] = React.useState<CalendarData>(initial);
  const [selected, setSelected] = React.useState<CalItem | null>(null);

  const days = React.useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") {
      const s = startOfWeek(anchor, { weekStartsOn });
      return eachDayOfInterval({ start: s, end: endOfWeek(anchor, { weekStartsOn }) });
    }
    const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn });
    const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [view, anchor, weekStartsOn]);

  const fromKey = format(days[0], "yyyy-MM-dd");
  const toKey = format(days[days.length - 1], "yyyy-MM-dd");

  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let active = true;
    fetchCalendarRange(fromKey, toKey).then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, [fromKey, toKey]);

  function toggleFilter(s: CalendarSource) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function shift(dir: 1 | -1) {
    setAnchor((a) =>
      view === "month"
        ? addMonths(a, dir)
        : view === "week"
          ? addWeeks(a, dir)
          : addDays(a, dir),
    );
  }

  const title =
    view === "day"
      ? format(anchor, "EEEE, d MMM yyyy")
      : view === "week"
        ? `${format(days[0], "d MMM")} – ${format(days[days.length - 1], "d MMM")}`
        : format(anchor, "MMMM yyyy");

  const filtered = (items: CalItem[]) =>
    items.filter((i) => filters.has(i.source));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronRightIcon className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date(`${today}T12:00:00`))}
            className="ml-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Today
          </button>
        </div>
        <div className="inline-flex gap-1 rounded-full bg-secondary p-1 text-xs">
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-full px-2.5 py-1 font-medium capitalize transition-colors",
                view === v
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <h2 className="font-display text-lg">{title}</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((s) => {
          const on = filters.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleFilter(s)}
              aria-pressed={on}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                on
                  ? "border-transparent text-foreground"
                  : "border-border text-muted-foreground opacity-60",
              )}
              style={on ? { backgroundColor: `color-mix(in srgb, ${SOURCE_META[s].color} 14%, transparent)` } : undefined}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: SOURCE_META[s].color }}
              />
              {SOURCE_META[s].label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {view === "month" ? (
        <MonthGrid
          days={days}
          anchor={anchor}
          today={today}
          data={data}
          timezone={timezone}
          weekStartsOn={weekStartsOn}
          filters={filters}
          onPick={(d) => {
            setAnchor(d);
            setView("day");
          }}
        />
      ) : (
        <div className="space-y-4">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const items = filtered(buildDayItems(data, key, timezone));
            return (
              <DaySection
                key={key}
                date={d}
                today={today}
                items={items}
                onItem={setSelected}
                showEmpty={view === "day"}
              />
            );
          })}
        </div>
      )}

      {/* Detail */}
      <ItemDetail
        item={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null);
          router.refresh();
          fetchCalendarRange(fromKey, toKey).then(setData);
        }}
      />
    </div>
  );
}

function MonthGrid({
  days,
  anchor,
  today,
  data,
  timezone,
  weekStartsOn,
  filters,
  onPick,
}: {
  days: Date[];
  anchor: Date;
  today: string;
  data: CalendarData;
  timezone: string;
  weekStartsOn: 0 | 1;
  filters: Set<CalendarSource>;
  onPick: (d: Date) => void;
}) {
  const headers = React.useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => format(addDays(base, i), "EEEEE"));
  }, [weekStartsOn]);

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {headers.map((h, i) => (
          <span key={i}>{h}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const counts = daySourceCounts(data, key, timezone);
          const inMonth = isSameMonth(d, anchor);
          const isToday = key === today;
          const sources = SOURCES.filter(
            (s) => filters.has(s) && (counts[s] ?? 0) > 0,
          );
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(d)}
              className={cn(
                "flex aspect-square flex-col items-center rounded-lg p-1 text-xs transition-colors hover:bg-secondary",
                !inMonth && "opacity-35",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full",
                  isToday && "bg-brand font-medium text-primary-foreground",
                )}
              >
                {format(d, "d")}
              </span>
              <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                {sources.map((s) => (
                  <span
                    key={s}
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: SOURCE_META[s].color }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DaySection({
  date,
  today,
  items,
  onItem,
  showEmpty,
}: {
  date: Date;
  today: string;
  items: CalItem[];
  onItem: (i: CalItem) => void;
  showEmpty: boolean;
}) {
  const key = format(date, "yyyy-MM-dd");
  const isToday = key === today;

  if (items.length === 0 && !showEmpty) return null;

  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        {format(date, "EEE, d MMM")}
        {isToday && (
          <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand">
            Today
          </span>
        )}
      </h3>
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="Nothing on this day"
          description="Add an event with the + button."
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onItem(item)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
            >
              <span
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {item.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {item.time ? `${item.time} · ` : ""}
                  {item.meta ?? SOURCE_META[item.source].label}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ItemDetail({
  item,
  onClose,
  onChanged,
}: {
  item: CalItem | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle className="font-display">
            {item ? SOURCE_META[item.source].label.replace(/s$/, "") : ""}
          </SheetTitle>
        </SheetHeader>
        {item && (
          <div className="p-4 pt-2">
            {item.source === "event" && item.event && (
              <EventForm initial={item.event} onDone={onChanged} />
            )}
            {item.source === "task" && item.task && (
              <div className="space-y-3">
                {item.task.status !== "done" && (
                  <Button
                    className="w-full"
                    onClick={async () => {
                      const res = await setTaskStatus(item.task!.id, "done");
                      if (!res.ok) toast.error(res.error);
                      else onChanged();
                    }}
                  >
                    <CheckIcon className="size-4" /> Mark done
                  </Button>
                )}
                <TaskForm initial={item.task} onDone={onChanged} />
              </div>
            )}
            {item.source === "bill" && item.bill && (
              <PayBillForm bill={item.bill} onDone={onChanged} />
            )}
            {item.source === "habit" && item.habit && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Scheduled habit for this day.
                </p>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/habits/${item.habit.id}`}>
                    <ExternalLinkIcon className="size-4" /> Open habit
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
