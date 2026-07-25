import type { Metadata } from "next";
import { TargetIcon, PlusIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getSavingsGoals } from "@/lib/queries/goals";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSheet } from "@/components/money/form-sheet";
import { GoalForm } from "@/components/money/goal-form";
import { GoalCard } from "@/components/money/goal-card";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Savings Goals" };

export default async function GoalsPage() {
  const profile = await requireOnboardedProfile();
  const { goals, totalTarget, totalSaved, overallPct } =
    await getSavingsGoals();
  const currency = profile.currency;

  return (
    <div className="space-y-5">
      {goals.length === 0 ? (
        <EmptyState
          icon={TargetIcon}
          title="No savings goals yet"
          description="Set goals like an emergency fund, a vacation, or a business fund — and watch them fill up."
          className="py-10"
          action={
            <FormSheet
              title="New goal"
              trigger={
                <Button>
                  <PlusIcon className="size-4" /> Add goal
                </Button>
              }
            >
              {(close) => <GoalForm onDone={close} />}
            </FormSheet>
          }
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
                    {formatMoney(totalSaved, currency)}
                  </p>
                </div>
                <p className="tnum text-sm text-muted-foreground">
                  of {formatMoney(totalTarget, currency)}
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
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>

          <FormSheet
            title="New goal"
            trigger={
              <Button variant="outline" className="w-full">
                <PlusIcon className="size-4" /> Add goal
              </Button>
            }
          >
            {(close) => <GoalForm onDone={close} />}
          </FormSheet>
        </>
      )}
    </div>
  );
}
