"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { BudgetForm } from "@/components/money/budget-form";

export function AddBudgetButton({
  usedCategoryIds,
}: {
  usedCategoryIds: string[];
}) {
  return (
    <FormSheet
      title="New budget"
      trigger={
        <Button variant="outline" className="w-full">
          <PlusIcon className="size-4" /> Add budget
        </Button>
      }
    >
      {(close) => (
        <BudgetForm usedCategoryIds={usedCategoryIds} onDone={close} />
      )}
    </FormSheet>
  );
}
