"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LIFE_AREA_MAP } from "@/lib/constants";
import { setHabitLog } from "@/app/(app)/habits/actions";
import type { HabitGrid as HabitGridData } from "@/lib/queries/habits";
import type { HabitStatus } from "@/lib/supabase/types";
import { toast } from "sonner";

export function HabitGrid({ initial }: { initial: HabitGridData }) {
  const [rows, setRows] = React.useState(initial.rows);
  const dayNums = Array.from({ length: initial.daysInMonth }, (_, i) => i + 1);
  const todayDay = Number(initial.today.slice(-2));

  async function toggle(habitId: string, dayIdx: number) {
    const row = rows.find((r) => r.habit.id === habitId);
    if (!row) return;
    const cell = row.cells[dayIdx];
    if (cell.future) return;
    const nextStatus: HabitStatus | null =
      cell.status === "completed" ? null : "completed";

    setRows((prev) =>
      prev.map((r) => {
        if (r.habit.id !== habitId) return r;
        const cells = r.cells.map((c, i) =>
          i === dayIdx ? { ...c, status: nextStatus } : c,
        );
        const total = cells.filter((c) => c.status === "completed").length;
        return {
          ...r,
          cells,
          total,
          pct: r.goal > 0 ? Math.round((total / r.goal) * 100) : 0,
        };
      }),
    );

    const res = await setHabitLog(habitId, cell.date, nextStatus);
    if (!res.ok) {
      toast.error(res.error);
      // revert
      setRows((prev) =>
        prev.map((r) => {
          if (r.habit.id !== habitId) return r;
          const cells = r.cells.map((c, i) =>
            i === dayIdx ? { ...c, status: cell.status } : c,
          );
          const total = cells.filter((c) => c.status === "completed").length;
          return {
            ...r,
            cells,
            total,
            pct: r.goal > 0 ? Math.round((total / r.goal) * 100) : 0,
          };
        }),
      );
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        No habits yet. Add some from the Habits tab.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 min-w-40 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Habit
            </th>
            {dayNums.map((d) => (
              <th
                key={d}
                className={cn(
                  "w-7 px-0 py-2 text-center text-[10px] font-medium tabular-nums",
                  d === todayDay
                    ? "bg-brand/10 text-brand"
                    : "text-muted-foreground",
                )}
              >
                {d}
              </th>
            ))}
            <th className="px-2 py-2 text-center text-[10px] font-medium text-muted-foreground">
              Total
            </th>
            <th className="px-2 py-2 text-center text-[10px] font-medium text-muted-foreground">
              Goal
            </th>
            <th className="min-w-24 px-2 py-2 text-center text-[10px] font-medium text-muted-foreground">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const color = LIFE_AREA_MAP[row.habit.life_area].color;
            return (
              <tr key={row.habit.id} className="border-b border-border last:border-0">
                <th className="sticky left-0 z-10 min-w-40 bg-card px-3 py-1.5 text-left font-medium">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{row.habit.name}</span>
                  </span>
                </th>
                {row.cells.map((cell, i) => {
                  const done = cell.status === "completed";
                  return (
                    <td key={cell.date} className="p-0 text-center">
                      <button
                        type="button"
                        disabled={cell.future}
                        onClick={() => toggle(row.habit.id, i)}
                        aria-label={`${row.habit.name} on day ${cell.day}`}
                        aria-pressed={done}
                        className={cn(
                          "mx-auto grid size-6 place-items-center rounded transition-colors",
                          cell.future && "cursor-not-allowed opacity-30",
                          !done &&
                            !cell.future &&
                            "hover:bg-secondary",
                          cell.day === todayDay && "ring-1 ring-brand/40",
                        )}
                      >
                        {done ? (
                          <span
                            className="grid size-4 place-items-center rounded-[3px] text-white"
                            style={{ backgroundColor: color }}
                          >
                            <CheckIcon className="size-3" />
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "size-4 rounded-[3px] border",
                              cell.scheduled
                                ? "border-border"
                                : "border-dashed border-border/50",
                            )}
                          />
                        )}
                      </button>
                    </td>
                  );
                })}
                <td className="tabular-nums px-2 py-1.5 text-center font-medium">
                  {row.total}
                </td>
                <td className="tabular-nums px-2 py-1.5 text-center text-muted-foreground">
                  {row.goal}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, row.pct)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="tabular-nums w-9 text-right text-xs text-muted-foreground">
                      {row.pct}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
