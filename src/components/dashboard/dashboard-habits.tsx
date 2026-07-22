"use client";

import * as React from "react";
import { CheckIcon, MinusIcon, XIcon, FlameIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LIFE_AREA_MAP } from "@/lib/constants";
import { nextStatus } from "@/lib/habits";
import {
  cycleHabitLog,
  refreshHabitsBoard,
} from "@/app/(app)/habits/actions";
import type { HabitBoardItem } from "@/lib/queries/habits";
import type { HabitStatus } from "@/lib/supabase/types";
import { toast } from "sonner";

function Mark({ status }: { status: HabitStatus | null }) {
  if (status === "completed") return <CheckIcon className="size-3.5" />;
  if (status === "skipped") return <MinusIcon className="size-3.5" />;
  if (status === "missed") return <XIcon className="size-3.5" />;
  return null;
}

export function DashboardHabits({
  initial,
  today,
}: {
  initial: HabitBoardItem[];
  today: string;
}) {
  const [items, setItems] = React.useState(initial);
  const [pending, setPending] = React.useState<string | null>(null);

  async function cycle(id: string) {
    const current = items.find((i) => i.habit.id === id);
    if (!current) return;
    const optimistic = nextStatus(current.todayStatus);
    setItems((prev) =>
      prev.map((i) => (i.habit.id === id ? { ...i, todayStatus: optimistic } : i)),
    );
    setPending(id);
    const result = await cycleHabitLog(id, today);
    if (!result.ok) {
      toast.error(result.error);
      setItems((prev) =>
        prev.map((i) =>
          i.habit.id === id ? { ...i, todayStatus: current.todayStatus } : i,
        ),
      );
    } else {
      const fresh = await refreshHabitsBoard();
      if (fresh.length) setItems(fresh);
    }
    setPending(null);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const color = LIFE_AREA_MAP[item.habit.life_area].color;
        const done = item.todayStatus === "completed";
        return (
          <button
            key={item.habit.id}
            type="button"
            onClick={() => cycle(item.habit.id)}
            disabled={pending === item.habit.id}
            aria-label={`Toggle ${item.habit.name}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm shadow-soft transition-all active:scale-95",
              done ? "border-transparent text-primary-foreground" : "border-border bg-card",
            )}
            style={done ? { backgroundColor: color } : undefined}
          >
            <span
              className={cn(
                "grid size-4 place-items-center rounded-full",
                !done && item.todayStatus && "text-muted-foreground",
              )}
            >
              <Mark status={item.todayStatus} />
            </span>
            {item.habit.name}
            {item.streak > 0 && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs",
                  done ? "text-primary-foreground/90" : "text-brand",
                )}
              >
                <FlameIcon className="size-3" />
                {item.streak}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
