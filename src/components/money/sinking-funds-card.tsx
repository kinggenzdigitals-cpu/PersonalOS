"use client";

import { format } from "date-fns";
import { PiggyBankIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { GoalForm } from "@/components/money/goal-form";
import { useCurrency } from "@/components/providers/profile-provider";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import type { SinkingFund } from "@/lib/queries/goals";

/**
 * Sinking funds = savings goals with a target date. Shows what to set aside
 * each month to land on time. Reuses the goal form/actions — nothing new to
 * learn, and the same rows appear on the Goals page.
 */
export function SinkingFundsCard({
  funds,
  todayKey,
}: {
  funds: SinkingFund[];
  todayKey: string;
}) {
  const currency = useCurrency();
  const monthlyTotal = funds.reduce((s, f) => s + f.math.requiredMonthly, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground">
            <PiggyBankIcon className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-medium leading-tight">Sinking funds</p>
            <p className="text-xs text-muted-foreground">
              {funds.length === 0 ? (
                "Save monthly toward dated expenses"
              ) : (
                <>
                  <Money value={monthlyTotal} currency={currency} />
                  /mo to stay on track
                </>
              )}
            </p>
          </div>
        </div>
        <FormSheet
          title="New sinking fund"
          description="A savings goal with a target date — e.g. annual insurance, tuition, Christmas."
          trigger={
            <Button variant="ghost" size="sm" className="gap-1.5">
              <PlusIcon className="size-3.5" aria-hidden />
              Add
            </Button>
          }
        >
          {(close) => <GoalForm onDone={close} todayKey={todayKey} />}
        </FormSheet>
      </div>

      {funds.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-center text-sm text-muted-foreground">
          Add a goal with a target date and we&rsquo;ll work out the monthly
          amount to set aside.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {funds.map(({ goal, math }) => {
            const color = goal.color ?? "var(--brand)";
            return (
              <li key={goal.id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate font-medium">{goal.name}</span>
                  </span>
                  <span className="tnum shrink-0 text-xs text-muted-foreground">
                    <Money value={Number(goal.saved_amount)} currency={currency} />{" "}
                    / <Money value={Number(goal.target_amount)} currency={currency} />
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${math.pct}%`, backgroundColor: color }}
                  />
                </div>
                <p
                  className={cn(
                    "tnum mt-1 text-xs",
                    math.overdue ? "text-error" : "text-muted-foreground",
                  )}
                >
                  By{" "}
                  {goal.target_date
                    ? format(new Date(`${goal.target_date}T00:00:00`), "MMM yyyy")
                    : "—"}
                  {math.reached ? (
                    " · reached 🎉"
                  ) : math.overdue ? (
                    " · target date passed"
                  ) : (
                    <>
                      {" · "}
                      <span className="font-medium text-foreground">
                        <Money value={math.requiredMonthly} currency={currency} />
                      </span>
                      /mo · {math.monthsLeft} month{math.monthsLeft === 1 ? "" : "s"} left
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
