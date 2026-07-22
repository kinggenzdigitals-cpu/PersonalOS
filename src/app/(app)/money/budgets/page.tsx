import type { Metadata } from "next";
import { PieChartIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getBudgetsWithSpending } from "@/lib/queries/planning";
import { EmptyState } from "@/components/ui/empty-state";
import { BudgetCard } from "@/components/money/budget-card";
import { AddBudgetButton } from "@/components/money/add-budget-button";

export const metadata: Metadata = { title: "Budgets" };

export default async function BudgetsPage() {
  const profile = await requireOnboardedProfile();
  const budgets = await getBudgetsWithSpending(profile.timezone);
  const usedCategoryIds = budgets.map((b) => b.budget.category_id);

  return (
    <div className="space-y-4">
      {budgets.length === 0 ? (
        <EmptyState
          icon={PieChartIcon}
          title="No budgets yet"
          description="Set a monthly limit for a category to track spending against it."
          className="py-10"
          action={<AddBudgetButton usedCategoryIds={usedCategoryIds} />}
        />
      ) : (
        <>
          <div className="space-y-3">
            {budgets.map((item) => (
              <BudgetCard
                key={item.budget.id}
                item={item}
                usedCategoryIds={usedCategoryIds}
              />
            ))}
          </div>
          <AddBudgetButton usedCategoryIds={usedCategoryIds} />
        </>
      )}
    </div>
  );
}
