"use client";

import { createElement } from "react";
import { FormSheet } from "@/components/money/form-sheet";
import { BudgetForm } from "@/components/money/budget-form";
import { useCurrency } from "@/components/providers/profile-provider";
import { categoryIcon } from "@/lib/category-icons";
import { clampPercent } from "@/lib/format";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import type { BudgetWithSpending } from "@/lib/queries/planning";

export function BudgetCard({
  item,
  usedCategoryIds,
}: {
  item: BudgetWithSpending;
  usedCategoryIds: string[];
}) {
  const currency = useCurrency();
  const { budget, category, spent, remaining, pct } = item;
  const iconComp = categoryIcon(category?.name ?? "");

  const state = pct > 100 ? "over" : pct >= 80 ? "warn" : "ok";
  const barColor =
    state === "over"
      ? "bg-error"
      : state === "warn"
        ? "bg-warning"
        : "bg-success";

  return (
    <FormSheet
      title="Edit budget"
      trigger={
        <button
          type="button"
          className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              <span className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground">
                {createElement(iconComp, {
                  className: "size-4",
                  "aria-hidden": true,
                })}
              </span>
              {category?.name ?? "Category"}
            </span>
            <span className="tnum text-sm text-muted-foreground">
              <Money value={spent} currency={currency} /> /{" "}
              <Money value={Number(budget.amount)} currency={currency} />
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${clampPercent(pct)}%` }}
            />
          </div>

          <p
            className={cn(
              "tnum mt-2 text-xs",
              state === "over" ? "text-error" : "text-muted-foreground",
            )}
          >
            {state === "over" ? (
              <>
                Over by <Money value={-remaining} currency={currency} />
              </>
            ) : (
              <>
                <Money value={remaining} currency={currency} /> left
              </>
            )}
          </p>
        </button>
      }
    >
      {(close) => (
        <BudgetForm
          initial={budget}
          usedCategoryIds={usedCategoryIds}
          onDone={close}
        />
      )}
    </FormSheet>
  );
}
