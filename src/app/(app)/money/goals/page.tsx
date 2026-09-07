import type { Metadata } from "next";
import { TargetIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { localDateKey } from "@/lib/date";
import { getSavingsGoals } from "@/lib/queries/goals";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GoalCard } from "@/components/money/goal-card";
import { GoalCreateButton } from "@/components/money/goal-create-button";
import { Money } from "@/components/ui/money";

export const metadata: Metadata = { title: "Savings Goals" };

export default async function GoalsPage() {
  const profile = await requireOnboardedProfile();
  const { goals, totalTarget, totalSaved, overallPct } =
    await getSavingsGoals();
  const currency = profile.currency;
  const todayKey = localDateKey(profile.timezone);

  return (
    <div className="space-y-5">
      {goals.length === 0 ? (
        <EmptyState
          icon={TargetIcon}
          title="No savings goals yet"
          description="Set goals like an emergency fund, a vacation, or a business fund — and watch them fill up."
          className="py-10"
          action={<GoalCreateButton empty todayKey={todayKey} />}
        />
      ) : (
        <>
          {/* Overall */}
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total saved</p>
                  <p className="tnum font-display text-2xl">
                    <Money value={totalSaved} currency={currency} />
                  </p>
                </div>
                <p className="tnum text-sm text-muted-foreground">
                  of <Money value={totalTarget} currency={currency} />
                </p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-sage transition-all"
                  style={{ width: `${Math.min(100, overallPct)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {overallPct}% of all goals funded
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} todayKey={todayKey} />
            ))}
          </div>

          <GoalCreateButton todayKey={todayKey} />
        </>
      )}
    </div>
  );
}
