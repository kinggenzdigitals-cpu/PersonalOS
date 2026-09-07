import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BanknoteIcon,
  CalendarDaysIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  PiggyBankIcon,
  PlusIcon,
  TrendingUpIcon,
  WalletCardsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { clampPercent } from "@/lib/format";
import { currentMonthStart, shiftMonthStart } from "@/lib/month";
import { BudgetCard } from "@/components/money/budget-card";
import { AddBudgetButton } from "@/components/money/add-budget-button";
import { MonthlyBudgetPlanButton } from "@/components/money/monthly-budget-plan-form";
import {
  BudgetTemplatePicker,
  CopyPreviousMonthButton,
} from "@/components/money/budget-template-picker";
import { SavingsAllocationButton } from "@/components/money/savings-allocation-form";
import type {
  BudgetRecommendation,
  MonthlyBudgetPlanner,
} from "@/lib/queries/budget-planner";

export function BudgetPlannerView({
  planner,
  currency,
  timezone,
}: {
  planner: MonthlyBudgetPlanner;
  currency: string;
  timezone: string;
}) {
  const usedCategoryIds = planner.budgets.map(
    (item) => item.budget.category_id,
  );
  const usedGoalIds = planner.savings.map(
    (item) => item.allocation.goal_id,
  );
  const allocatedPct =
    planner.summary.totalBudget > 0
      ? (planner.summary.allocated / planner.summary.totalBudget) * 100
      : 0;

  return (
    <div className="space-y-5">
      <MonthHeader
        monthStart={planner.monthStart}
        label={planner.label}
        timezone={timezone}
      />

      <Card className="shadow-card">
        <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total monthly budget
            </p>
            <p className="tnum mt-1 font-display text-3xl tracking-tight">
              <Money value={planner.summary.totalBudget} currency={currency} />
            </p>
            {planner.summary.carryover > 0 && (
              <p className="tnum mt-1 text-xs text-success">
                +<Money value={planner.summary.carryover} currency={currency} /> available from carry-over
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            <MonthlyBudgetPlanButton
              monthStart={planner.monthStart}
              plan={planner.plan}
            />
            <BudgetTemplatePicker
              monthStart={planner.monthStart}
              totalBudget={planner.summary.totalBudget}
              goals={planner.goals}
            />
            <CopyPreviousMonthButton monthStart={planner.monthStart} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                allocatedPct > 100 ? "bg-error" : "bg-brand",
              )}
              style={{ width: `${clampPercent(allocatedPct)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground">
            <span>{Math.round(allocatedPct)}% allotted</span>
            <span>Categories + required savings</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="Allocated"
          value={planner.summary.allocated}
          currency={currency}
          detail="Spending + savings"
        />
        <SummaryCard
          label="Spent"
          value={planner.summary.spent}
          currency={currency}
          detail="Actual expenses"
        />
        <SummaryCard
          label="Remaining"
          value={planner.summary.remaining}
          currency={currency}
          detail="After spending + saved"
          danger={planner.summary.remaining < 0}
        />
        <SummaryCard
          label="Unallocated"
          value={planner.summary.unallocated}
          currency={currency}
          detail="Still needs a purpose"
          danger={planner.summary.unallocated < 0}
        />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg">Spending allotments</h2>
            <p className="text-xs text-muted-foreground">
              Split the budget into bills, food, transport, and other categories.
            </p>
          </div>
          <AddBudgetButton
            monthStart={planner.monthStart}
            usedCategoryIds={usedCategoryIds}
            compact
          />
        </div>
        {planner.budgets.length > 0 ? (
          <div className="space-y-3">
            {planner.budgets.map((item) => (
              <BudgetCard
                key={item.budget.id}
                item={item}
                monthStart={planner.monthStart}
                usedCategoryIds={usedCategoryIds}
              />
            ))}
          </div>
        ) : (
          <EmptySection
            icon={WalletCardsIcon}
            title="No spending allotments"
            text="Add categories manually or use a template."
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg">Required savings</h2>
            <p className="text-xs text-muted-foreground">
              Savings and sinking funds are included before optional spending.
            </p>
          </div>
          {planner.goals.length > 0 ? (
            <SavingsAllocationButton
              monthStart={planner.monthStart}
              goals={planner.goals}
              usedGoalIds={usedGoalIds}
            />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/money/goals">
                <PlusIcon className="size-3.5" /> Create goal
              </Link>
            </Button>
          )}
        </div>
        {planner.savings.length > 0 ? (
          <div className="space-y-3">
            {planner.savings.map((item) => {
              const goalType =
                item.goal?.goal_type === "sinking_fund"
                  ? "Sinking fund"
                  : item.goal?.goal_type === "emergency_fund"
                    ? "Emergency fund"
                    : "Savings goal";
              return (
                <SavingsAllocationButton
                  key={item.allocation.id}
                  monthStart={planner.monthStart}
                  goals={planner.goals}
                  usedGoalIds={usedGoalIds}
                  initial={item.allocation}
                  trigger={
                    <button
                      type="button"
                      className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium">
                              {item.goal?.name ?? "Savings"}
                            </span>
                            <Badge variant="secondary">{goalType}</Badge>
                          </div>
                          <p className="tnum mt-1 text-xs text-muted-foreground">
                            <Money value={item.savedThisMonth} currency={currency} /> saved this month
                          </p>
                        </div>
                        <span className="tnum shrink-0 text-sm text-muted-foreground">
                          <Money value={Number(item.allocation.amount)} currency={currency} />
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-success transition-all"
                          style={{ width: `${clampPercent(item.pct)}%` }}
                        />
                      </div>
                    </button>
                  }
                />
              );
            })}
          </div>
        ) : (
          <EmptySection
            icon={PiggyBankIcon}
            title="No savings allotted"
            text="Choose a goal and set the required amount for this month."
          />
        )}
        {planner.savings.length > 0 && (
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/money/goals">Open goals to add saved funds</Link>
          </Button>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <ForecastCard planner={planner} currency={currency} />
        <CashFlowCard planner={planner} currency={currency} />
      </div>

      <RecommendationsCard
        items={planner.recommendations}
        hasPlan={planner.summary.totalBudget > 0}
      />
    </div>
  );
}

function MonthHeader({
  monthStart,
  label,
  timezone,
}: {
  monthStart: string;
  label: string;
  timezone: string;
}) {
  const current = currentMonthStart(timezone);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <CalendarDaysIcon className="size-5 text-brand" />
        <div>
          <p className="text-xs text-muted-foreground">Budget month</p>
          <h2 className="font-display text-xl">{label}</h2>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button asChild variant="outline" size="icon-sm">
          <Link
            href={`/money/budgets?month=${shiftMonthStart(monthStart, -1)}`}
            aria-label="Previous month"
          >
            <ArrowLeftIcon />
          </Link>
        </Button>
        {monthStart !== current && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/money/budgets">This month</Link>
          </Button>
        )}
        <Button asChild variant="outline" size="icon-sm">
          <Link
            href={`/money/budgets?month=${shiftMonthStart(monthStart, 1)}`}
            aria-label="Next month"
          >
            <ArrowRightIcon />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  currency,
  detail,
  danger = false,
}: {
  label: string;
  value: number;
  currency: string;
  detail: string;
  danger?: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("tnum mt-1 font-display text-lg", danger && "text-error")}>
          <Money value={value} currency={currency} />
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ForecastCard({
  planner,
  currency,
}: {
  planner: MonthlyBudgetPlanner;
  currency: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUpIcon className="size-4 text-brand" /> Budget forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ValueRow
          label="Spending ceiling"
          value={planner.forecast.spendingCeiling}
          currency={currency}
        />
        <ValueRow
          label={planner.isPastMonth ? "Actual expenses" : "Projected expenses"}
          value={planner.forecast.expense}
          currency={currency}
        />
        <div className="border-t border-border pt-3">
          <ValueRow
            label={planner.forecast.projectedOver > 0 ? "Projected over" : "Projected left"}
            value={
              planner.forecast.projectedOver > 0
                ? planner.forecast.projectedOver
                : planner.forecast.remaining
            }
            currency={currency}
            danger={planner.forecast.projectedOver > 0}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Based on the average daily spending recorded in this month.
        </p>
      </CardContent>
    </Card>
  );
}

function CashFlowCard({
  planner,
  currency,
}: {
  planner: MonthlyBudgetPlanner;
  currency: string;
}) {
  if (planner.isPastMonth) {
    const net = planner.cashFlow.incomeReceived - planner.summary.spent;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BanknoteIcon className="size-4 text-brand" /> Cash-flow summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ValueRow
            label="Income received"
            value={planner.cashFlow.incomeReceived}
            currency={currency}
          />
          <ValueRow
            label="Expenses recorded"
            value={planner.summary.spent}
            currency={currency}
            subtract
          />
          <div className="border-t border-border pt-3">
            <ValueRow
              label="Net cash flow"
              value={net}
              currency={currency}
              danger={net < 0}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BanknoteIcon className="size-4 text-brand" /> Cash-flow outlook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ValueRow
          label="Available now"
          value={planner.cashFlow.availableNow}
          currency={currency}
        />
        <ValueRow
          label="Expected income"
          value={planner.cashFlow.expectedIncome}
          currency={currency}
        />
        <ValueRow
          label="Income received"
          value={planner.cashFlow.incomeReceived}
          currency={currency}
        />
        <ValueRow
          label="Expected income left"
          value={planner.cashFlow.expectedIncomeLeft}
          currency={currency}
        />
        <ValueRow
          label="Bills due or overdue"
          value={planner.cashFlow.upcomingBills}
          currency={currency}
          subtract
        />
        <div className="border-t border-border pt-3">
          <ValueRow
            label="Projected available"
            value={planner.cashFlow.projectedAvailable}
            currency={currency}
            danger={planner.cashFlow.projectedAvailable < 0}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Current spending balances + expected income left − bills due or overdue.
        </p>
      </CardContent>
    </Card>
  );
}

function ValueRow({
  label,
  value,
  currency,
  danger = false,
  subtract = false,
}: {
  label: string;
  value: number;
  currency: string;
  danger?: boolean;
  subtract?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tnum font-medium", danger && "text-error")}>
        {subtract && value > 0 ? "−" : ""}
        <Money value={value} currency={currency} />
      </span>
    </div>
  );
}

function RecommendationsCard({
  items,
  hasPlan,
}: {
  items: BudgetRecommendation[];
  hasPlan: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleAlertIcon className="size-4 text-brand" /> Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length > 0 ? (
          items.map((item, index) => {
            const Icon =
              item.level === "error"
                ? CircleAlertIcon
                : item.level === "warning"
                  ? AlertTriangleIcon
                  : InfoIcon;
            return (
              <div
                key={`${item.title}-${index}`}
                className={cn(
                  "flex gap-3 rounded-xl p-3",
                  item.level === "error"
                    ? "bg-error/10"
                    : item.level === "warning"
                      ? "bg-warning/10"
                      : "bg-secondary/60",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    item.level === "error"
                      ? "text-error"
                      : item.level === "warning"
                        ? "text-warning"
                        : "text-brand",
                  )}
                />
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex gap-3 rounded-xl bg-success/10 p-3">
            <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
            <div>
              <p className="text-sm font-medium">
                {hasPlan ? "Your monthly plan looks healthy" : "Start your monthly plan"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We will flag possible overspending and cash shortages here.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptySection({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof PiggyBankIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
      <Icon className="mx-auto size-6 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
