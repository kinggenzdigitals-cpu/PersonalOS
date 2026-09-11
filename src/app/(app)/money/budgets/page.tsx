import type { Metadata } from "next";
import { ChartPieIcon, PieChartIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { localDateKey } from "@/lib/date";
import { getBudgetSummary, getCashFlowForecast } from "@/lib/queries/planning";
import { getSinkingFunds } from "@/lib/queries/goals";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthlyBudgetCard } from "@/components/money/monthly-budget-card";
import { CashFlowCard } from "@/components/money/cash-flow-card";
import { SinkingFundsCard } from "@/components/money/sinking-funds-card";
import { BudgetCard } from "@/components/money/budget-card";
import { AddBudgetButton } from "@/components/money/add-budget-button";
import { MoneySectionHeading } from "@/components/money/money-section-heading";

export const metadata: Metadata = { title: "Budgets" };

export default async function BudgetsPage() {
  const profile = await requireOnboardedProfile();
  const [summary, forecast, funds] = await Promise.all([
    getBudgetSummary(profile.timezone, profile.currency),
    getCashFlowForecast(profile.timezone),
    getSinkingFunds(profile.timezone),
  ]);
  const { items } = summary;
  const usedCategoryIds = items.map((b) => b.budget.category_id);
  const todayKey = localDateKey(profile.timezone);

  return (
    <div className="space-y-4">
      <MoneySectionHeading
        icon={ChartPieIcon}
        title="Budgets"
        description="Plan the month, watch each category, and protect what remains."
      />
      <MonthlyBudgetCard summary={summary} />

      <div className="grid gap-4 lg:grid-cols-2">
        <CashFlowCard forecast={forecast} />
        <SinkingFundsCard funds={funds} todayKey={todayKey} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Allotments
          </h2>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={PieChartIcon}
            title="No allotments yet"
            description="Set a monthly limit for a category to track spending against it."
            className="py-10"
            action={<AddBudgetButton usedCategoryIds={usedCategoryIds} />}
          />
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((item) => (
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
      </section>
    </div>
  );
}
