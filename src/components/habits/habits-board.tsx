"use client";

import * as React from "react";
import Link from "next/link";
import { CheckIcon, MinusIcon, XIcon, FlameIcon } from "lucide-react";
import { FormSheet } from "@/components/money/form-sheet";
import { HabitForm } from "@/components/habits/habit-form";
import { cn } from "@/lib/utils";
import { LIFE_AREAS, LIFE_AREA_MAP } from "@/lib/constants";
import { nextStatus } from "@/lib/habits";
import {
  cycleHabitLog,
  refreshHabitsBoard,
} from "@/app/(app)/habits/actions";
import type { HabitBoardItem } from "@/lib/queries/habits";
import type { HabitStatus } from "@/lib/supabase/types";
import { toast } from "sonner";

function StatusMark({
  status,
  color,
}: {
  status: HabitStatus | null;
  color: string;
}) {
  if (status === "completed")
    return (
      <span
        className="grid size-10 place-items-center rounded-full text-primary-foreground"
        style={{ backgroundColor: color }}
      >
        <CheckIcon className="size-5" />
      </span>
    );
  if (status === "skipped")
    return (
      <span className="grid size-10 place-items-center rounded-full border border-border bg-secondary text-muted-foreground">
        <MinusIcon className="size-5" />
      </span>
    );
  if (status === "missed")
    return (
      <span className="grid size-10 place-items-center rounded-full bg-error/15 text-error">
        <XIcon className="size-5" />
      </span>
    );
  return (
    <span className="grid size-10 place-items-center rounded-full border-2 border-dashed border-border" />
  );
}

function stripColor(status: HabitStatus | null, color: string) {
  if (status === "completed") return { backgroundColor: color };
  if (status === "missed")
    return { backgroundColor: "color-mix(in srgb, var(--error) 30%, transparent)" };
  if (status === "skipped") return { backgroundColor: "var(--muted)" };
  return { backgroundColor: "var(--secondary)" };
}

export function HabitsBoard({
  initial,
  today,
}: {
  initial: HabitBoardItem[];
  today: string;
}) {
  const [items, setItems] = React.useState(initial);
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  async function cycle(habitId: string) {
    const current = items.find((i) => i.habit.id === habitId);
    if (!current) return;
    const optimistic = nextStatus(current.todayStatus);

    setItems((prev) =>
      prev.map((i) =>
        i.habit.id === habitId ? { ...i, todayStatus: optimistic } : i,
      ),
    );
    setPending((p) => new Set(p).add(habitId));

    const result = await cycleHabitLog(habitId, today);
    if (!result.ok) {
      toast.error(result.error);
      setItems((prev) =>
        prev.map((i) =>
          i.habit.id === habitId
            ? { ...i, todayStatus: current.todayStatus }
            : i,
        ),
      );
    } else {
      const fresh = await refreshHabitsBoard();
      if (fresh.length) setItems(fresh);
    }
    setPending((p) => {
      const n = new Set(p);
      n.delete(habitId);
      return n;
    });
  }

  const grouped = LIFE_AREAS.map((area) => ({
    area,
    items: items.filter((i) => i.habit.life_area === area.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {grouped.map(({ area, items: group }) => (
        <section key={area.value} className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: area.color }}
            />
            {area.label}
          </h2>
          <div className="space-y-2">
            {group.map((item) => {
              const color = LIFE_AREA_MAP[item.habit.life_area].color;
              return (
                <div
                  key={item.habit.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-soft"
                >
                  <button
                    type="button"
                    onClick={() => cycle(item.habit.id)}
                    disabled={pending.has(item.habit.id)}
                    aria-label={`Toggle ${item.habit.name} for today`}
                    className="shrink-0 rounded-full transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <StatusMark status={item.todayStatus} color={color} />
                  </button>

                  <Link
                    href={`/habits/${item.habit.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {item.habit.name}
                      </span>
                      {item.streak > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-brand">
                          <FlameIcon className="size-3.5" />
                          {item.streak}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      {item.last7.map((d) => (
                        <span
                          key={d.date}
                          className={cn(
                            "h-1.5 flex-1 rounded-full",
                            d.date === today && "ring-1 ring-brand/40",
                          )}
                          style={stripColor(d.status, color)}
                          title={`${d.date}: ${d.status ?? "not logged"}`}
                        />
                      ))}
                    </div>
                  </Link>

                  <FormSheet
                    title="Edit habit"
                    trigger={
                      <button
                        type="button"
                        className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        Edit
                      </button>
                    }
                  >
                    {(close) => (
                      <HabitForm initial={item.habit} onDone={close} />
                    )}
                  </FormSheet>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
