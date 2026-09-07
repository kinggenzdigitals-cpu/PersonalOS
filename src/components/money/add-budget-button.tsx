"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { BudgetForm } from "@/components/money/budget-form";

export function AddBudgetButton({
  usedCategoryIds,
  monthStart,
  compact = false,
}: {
  usedCategoryIds: string[];
  monthStart: string;
  compact?: boolean;
}) {
  return (
    <FormSheet
      title="New budget"
      trigger={
        <Button variant="outline" size={compact ? "sm" : "default"} className={compact ? undefined : "w-full"}>
          <PlusIcon className="size-4" /> Add allotment
        </Button>
      }
    >
      {(close) => (
        <BudgetForm
          monthStart={monthStart}
          usedCategoryIds={usedCategoryIds}
          onDone={close}
        />
      )}
    </FormSheet>
  );
}
