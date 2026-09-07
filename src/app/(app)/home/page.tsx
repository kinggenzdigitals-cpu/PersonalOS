import Link from "next/link";
import { format } from "date-fns";
import {
  CalendarClockIcon,
  SparklesIcon,
  WalletIcon,
  ChevronDownIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardedProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { greeting, longDate } from "@/lib/greeting";
import { formatMoney } from "@/lib/format";
import { Money, MaskAmounts } from "@/components/ui/money";
import { dayRange } from "@/lib/date";
import {
  getBudgetSummary,
  getCashFlowForecast,
  getBills,
} from "@/lib/queries/planning";
import { getSinkingFunds, getSavingsGoals } from "@/lib/queries/goals";
import { getTransactions, getCategories } from "@/lib/queries/money";
import { getHabitsBoard, localToday } from "@/lib/queries/habits";
import { getTodayMood } from "@/lib/queries/mood";
import { getLedgerSummary } from "@/lib/queries/ledger";
import {
  getTodayPriorities,
  getPriorityCandidates,
  getCarryOverTasks,
  getTasksByView,
} from "@/lib/queries/tasks";
import { computeFinancialHealth } from "@/lib/financial-health";
import { isCardVisible, readPrefs } from "@/lib/dashboard-cards";
import { NetPositionCard } from "@/components/money/net-position";
import {
  AlertsStrip,
  type DashboardAlert,
} from "@/components/dashboard/alerts-strip";
import {
  BudgetSummaryCard,
  CashAvailableCard,
  UpcomingBillsCard,
  RecentTransactionsCard,
} from "@/components/dashboard/finance-cards";
import { HealthScoreCard } from "@/components/dashboard/health-score-card";
import { DashboardCustomizer } from "@/components/dashboard/dashboard-customizer";
import { CashFlowCard } from "@/components/money/cash-flow-card";
import { SinkingFundsCard } from "@/components/money/sinking-funds-card";
import { DashboardHabits } from "@/components/dashboard/dashboard-habits";
import { FocusWidget } from "@/components/dashboard/focus-widget";
import { GoalsWidget } from "@/components/dashboard/goals-widget";
import { DashboardPriorities } from "@/components/dashboard/dashboard-priorities";
import { CarryOver } from "@/components/dashboard/carry-over";
import { MoodChip } from "@/components/dashboard/mood-chip";
import { ReceiptTextIcon, CircleCheckBigIcon, BarChart3Icon } from "lucide-react";
import type { AccountBalance, Transaction } from "@/lib/supabase/types";

export default async function HomePage() {
  const profile = await requireOnboardedProfile();
  const supabase = await createClient();
  const today = dayRange(profile.timezone);
  const todayKey = format(localToday(profile.timezone), "yyyy-MM-dd");
  const currency = profile.currency;
  const prefs = readPrefs(profile.dashboard_prefs);
  const show = (key: Parameters<typeof isCardVisible>[0]) =>
    isCardVisible(key, prefs);

  const [
    { data: balances },
    board,
    { data: todayExpenses },
    summary,
    forecast,
    bills,
    funds,
    goals,
    recentTx,
    categories,
    todayMood,
    priorities,
    candidates,
    carryOver,
    todayTasks,
    ledger,
  ] = await Promise.all([
    supabase
      .from("account_balances")
      .select("*")
      .eq("archived", false)
      .returns<AccountBalance[]>(),
    getHabitsBoard(profile.timezone),
    supabase
      .from("transactions")
      .select("amount")
      .eq("type", "expense")
      .gte("occurred_at", today.start)
      .lte("occurred_at", today.end)
      .returns<Pick<Transaction, "amount">[]>(),
    getBudgetSummary(profile.timezone, currency),
    getCashFlowForecast(profile.timezone),
    getBills(profile.timezone, true),
    getSinkingFunds(profile.timezone),
    getSavingsGoals(),
    getTransactions({ limit: 5, offset: 0 }),
    getCategories(),
    getTodayMood(profile.timezone),
    getTodayPriorities(profile.timezone),
    getPriorityCandidates(profile.timezone),
    getCarryOverTasks(profile.timezone),
    getTasksByView("today", profile.timezone),
    getLedgerSummary(profile.timezone),
  ]);

  const accounts = balances ?? [];
  const budgets = summary.items;
  const total = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const available = accounts
    .filter((a) => a.is_spending)
    .reduce((sum, a) => sum + Number(a.balance), 0);
  const spentToday = (todayExpenses ?? []).reduce(
    (sum, t) => sum + Number(t.amount),
    0,
  );

  const nextBill = bills[0] ?? null;
  const overdueBills = bills.filter((b) => b.status === "overdue").length;

  const health = computeFinancialHealth({
    budget: summary,
    forecast,
    goals,
    overdueBills,
    totalBills: bills.length,
  });

  // Build dashboard alerts (budgets, bills, low balances)
  const alerts: DashboardAlert[] = [];
  for (const b of budgets) {
    if (b.pct > 100) {
      alerts.push({
        level: "error",
        text: `${b.category?.name ?? "A budget"} is over by ${formatMoney(
          -b.remaining,
          currency,
        )}`,
        href: "/money/budgets",
      });
    } else if (b.pct >= 80) {
      alerts.push({
        level: "warning",
        text: `${b.category?.name ?? "A budget"} is at ${Math.round(b.pct)}% of budget`,
        href: "/money/budgets",
      });
    }
  }
  // Over-allocation / over-total warnings from the monthly budget itself.
  for (const r of summary.recommendations) {
    if (r.tone === "warn") {
      alerts.push({ level: "warning", text: r.text, href: "/money/budgets" });
    }
  }
  for (const b of bills) {
    if (b.status === "overdue") {
      alerts.push({
        level: "error",
        text: `${b.bill.name} is overdue (${formatMoney(Number(b.bill.amount), currency)})`,
        href: "/money/bills",
      });
    } else if (b.status === "due_soon") {
      alerts.push({
        level: "warning",
        text: `${b.bill.name} is due ${
          b.daysUntilDue <= 0 ? "today" : `in ${b.daysUntilDue}d`
        }`,
        href: "/money/bills",
      });
    }
  }
  for (const a of accounts) {
    const threshold = profile.low_balance_threshold;
    if (a.is_spending && Number(a.balance) < threshold) {
      alerts.push({
        level: "warning",
        text: `${a.name} is low (${formatMoney(Number(a.balance), currency)})`,
        href: "/money",
      });
    }
  }

  // Daily progress: (habits completed + priorities done) / (scheduled + set)
  const scheduledHabits = board.filter((b) => b.scheduledToday);
  const completedHabits = scheduledHabits.filter(
    (b) => b.todayStatus === "completed",
  ).length;
  const donePriorities = priorities.filter((t) => t.status === "done").length;
  const progressDenom = scheduledHabits.length + priorities.length;
  const progressDone = completedHabits + donePriorities;
  const progressPct =
    progressDenom > 0 ? Math.round((progressDone / progressDenom) * 100) : 0;

  // Weekly (Sunday) / monthly (1st) review nudge
  const todayDate = new Date(`${todayKey}T12:00:00`);
  const reviewNudge: { text: string; href: string } | null = todayKey.endsWith(
    "-01",
  )
    ? {
        text: "Your monthly review is ready",
        href: "/reports?period=month&offset=-1",
      }
    : todayDate.getDay() === 0
      ? {
          text: "Your weekly review is ready",
          href: "/reports?period=week&offset=-1",
        }
      : null;

  // Today's schedule: bill due dates + task deadlines (events arrive with the calendar)
  type ScheduleItem = {
    key: string;
    label: string;
    meta: string;
    kind: "bill" | "task";
  };
  const schedule: ScheduleItem[] = [];
  for (const b of bills) {
    if (b.bill.next_due_date === todayKey) {
      schedule.push({
        key: `bill-${b.bill.id}`,
        label: b.bill.name,
        meta: `Bill · ${formatMoney(Number(b.bill.amount), currency)}`,
        kind: "bill",
      });
    }
  }
  for (const t of todayTasks) {
    if (t.due_date === todayKey) {
      schedule.push({
        key: `task-${t.id}`,
        label: t.title,
        meta: t.status === "done" ? "Task · done" : "Task · due today",
        kind: "task",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <h1 className="font-display text-2xl tracking-tight">
              {greeting(profile.timezone, profile.display_name)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {longDate(profile.timezone)}
            </p>
          </div>
          <DashboardCustomizer prefs={prefs} />
        </div>
        <MoodChip today={todayKey} entry={todayMood} />
      </header>

      {/* Weekly / monthly review nudge */}
      {reviewNudge && (
        <Link
          href={reviewNudge.href}
          className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5 text-sm text-brand transition-colors hover:bg-brand/10"
        >
          <BarChart3Icon className="size-4 shrink-0" />
          <span className="flex-1">{reviewNudge.text}</span>
          <span>→</span>
        </Link>
      )}

      {/* Alerts */}
      {show("alerts") && <AlertsStrip alerts={alerts} />}

      {/* ---- Finance first ---- */}

      {show("monthly_budget") && (
        <BudgetSummaryCard summary={summary} currency={currency} />
      )}

      {/* Net position */}
      <Link
        href="/money"
        className="block transition-transform hover:-translate-y-0.5"
      >
        <NetPositionCard
          cash={total}
          receivable={ledger.totalReceivable}
          payable={ledger.totalPayable}
          available={available}
          currency={currency}
        />
      </Link>

      {/* Today's money */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <WalletIcon className="size-3.5" /> Spent today
          </p>
          <p className="tnum mt-1 font-display text-lg">
            <Money value={spentToday} currency={currency} />
          </p>
        </div>
        <Link
          href="/money/bills"
          className="rounded-xl border border-border bg-card p-3 shadow-soft transition-colors hover:border-brand/40"
        >
          <p className="text-xs text-muted-foreground">Next bill</p>
          <p className="tnum mt-1 font-display text-lg">
            {nextBill ? (
              <Money
                value={Number(nextBill.bill.amount)}
                currency={currency}
                compact
              />
            ) : (
              "—"
            )}
          </p>
          {nextBill && (
            <p className="truncate text-[11px] text-muted-foreground">
              {nextBill.bill.name} ·{" "}
              {nextBill.daysUntilDue < 0
                ? `${Math.abs(nextBill.daysUntilDue)}d overdue`
                : nextBill.daysUntilDue === 0
                  ? "due today"
                  : `due in ${nextBill.daysUntilDue}d`}
            </p>
          )}
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {show("cash_available") && (
          <CashAvailableCard
            accounts={accounts}
            currency={currency}
            lowThreshold={profile.low_balance_threshold}
          />
        )}
        {show("cash_flow") && <CashFlowCard forecast={forecast} />}
        {show("upcoming_bills") && (
          <UpcomingBillsCard bills={forecast.upcomingBills} currency={currency} />
        )}
        {show("health_score") && <HealthScoreCard health={health} />}
      </div>

      {show("savings") && <GoalsWidget currency={currency} />}

      {show("sinking_funds") && funds.length > 0 && (
        <SinkingFundsCard funds={funds} todayKey={todayKey} />
      )}

      {show("recent_transactions") && (
        <RecentTransactionsCard
          transactions={recentTx}
          categories={categories}
          currency={currency}
        />
      )}

      {/* ---- Life ---- */}

      {/* Carry-over prompt */}
      <CarryOver count={carryOver.length} />

      {show("priorities") && (
        <DashboardPriorities priorities={priorities} candidates={candidates} />
      )}

      {show("focus") && <FocusWidget timezone={profile.timezone} />}

      {/* Full task list link */}
      <Link
        href="/tasks"
        className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-soft transition-colors hover:border-brand/40"
      >
        <span className="flex items-center gap-2">
          <CircleCheckBigIcon className="size-4 text-muted-foreground" />
          All tasks
        </span>
        <span className="text-muted-foreground">→</span>
      </Link>

      {/* Today's habits — collapsible, and switchable off in Customise */}
      {show("habits") && (
        <details open className="group space-y-3">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-display text-lg">
              <ChevronDownIcon
                className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
              Today&apos;s habits
            </h2>
            <Link
              href="/habits"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          </summary>
          <div className="mt-3 space-y-3">
            {board.length > 0 ? (
              <DashboardHabits
                key={board.map((b) => b.habit.id).join(",")}
                initial={board}
                today={todayKey}
              />
            ) : (
              <EmptyState
                icon={SparklesIcon}
                title="No habits yet"
                description="Add a habit to start building momentum."
                action={
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/habits">Go to Habits</Link>
                  </Button>
                }
              />
            )}

            {progressDenom > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Today&apos;s progress
                  </span>
                  <span className="tnum text-muted-foreground">
                    {progressDone}/{progressDenom} done
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-sage transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Today's schedule */}
      {show("schedule") && (
        <section className="space-y-3">
          <h2 className="font-display text-lg">Today&apos;s schedule</h2>
          {schedule.length > 0 ? (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-soft">
              {schedule.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full",
                      item.kind === "bill"
                        ? "bg-warning/10 text-warning"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {item.kind === "bill" ? (
                      <ReceiptTextIcon className="size-4" />
                    ) : (
                      <CircleCheckBigIcon className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      <MaskAmounts text={item.meta} />
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarClockIcon}
              title="Nothing scheduled"
              description="Bills and task deadlines for today will show up here."
            />
          )}
        </section>
      )}
    </div>
  );
}
