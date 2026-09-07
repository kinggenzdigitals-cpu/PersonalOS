import type { Metadata } from "next";
import { requireOnboardedProfile } from "@/lib/auth";
import { resolveMonthStart } from "@/lib/month";
import { getMonthlyBudgetPlanner } from "@/lib/queries/budget-planner";
import { BudgetPlannerView } from "@/components/money/budget-planner-view";

export const metadata: Metadata = { title: "Budgets" };

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const profile = await requireOnboardedProfile();
  const { month } = await searchParams;
  const monthStart = resolveMonthStart(month, profile.timezone);
  const planner = await getMonthlyBudgetPlanner(
    profile.timezone,
    monthStart,
    profile.currency,
  );

  return (
    <BudgetPlannerView
      planner={planner}
      currency={profile.currency}
      timezone={profile.timezone}
    />
  );
}
