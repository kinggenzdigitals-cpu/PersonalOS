"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ChartColumnBigIcon,
  ChartPieIcon,
  Loader2Icon,
  PencilIcon,
  PiggyBankIcon,
  ScaleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Money } from "@/components/ui/money";
import { clampPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/budget-report";
import type {
  BudgetReport,
  BudgetReportRow,
  BudgetStatus,
} from "@/lib/budget-report";

/**
 * Colours for the "share of total spending" chart are deliberately drawn from
 * the neutral chart ramp, never from the success/warning/error tokens used by
 * the budget-progress bars. Two charts that share a colour language invite the
 * exact misreading this screen must prevent: "78% of budget used" and "78% of
 * total spending" mean completely different things.
 */
const SHARE_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--sage)",
  "var(--brand-2)",
];

const MONTH_OPTION_COUNT = 13;

/** Bar/text colour for a budget-usage status. Never a hex — dark mode is token-driven. */
function statusTone(status: BudgetStatus): {
  bar: string;
  text: string;
  pill: string;
} {
  switch (status) {
    case "over":
      return {
        bar: "bg-error",
        text: "text-error",
        pill: "border-error/30 bg-error/10 text-error",
      };
    case "at":
      return {
        bar: "bg-warning",
        text: "text-warning",
        pill: "border-warning/40 bg-warning/15 text-warning",
      };
    case "near":
      return {
        bar: "bg-warning",
        text: "text-warning",
        pill: "border-warning/30 bg-warning/10 text-warning",
      };
    case "within":
      return {
        bar: "bg-success",
        text: "text-success",
        pill: "border-success/30 bg-success/10 text-success",
      };
    default:
      return {
        bar: "bg-muted-foreground/30",
        text: "text-muted-foreground",
        pill: "border-border bg-secondary text-muted-foreground",
      };
  }
}

/**
 * Month arithmetic on the "YYYY-MM" key itself, not on a Date. Constructing a
 * Date to step months is where timezone bugs get in: the user's month boundary
 * is decided on the server from their profile timezone, and a browser in a
 * different zone must not shift it by a month.
 */
function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * `${key}-01T00:00:00` (no trailing Z) parses as *local* midnight, so the label
 * can never render the previous month for users west of UTC.
 */
function monthLabel(key: string): string {
  return format(new Date(`${key}-01T00:00:00`), "MMMM yyyy");
}

/** Percentages, not money — never masked. One decimal below 10 so a 0.4% slice isn't printed as 0%. */
function formatPct(n: number): string {
  return `${n < 10 ? Math.round(n * 10) / 10 : Math.round(n)}%`;
}

function rowKey(row: BudgetReportRow): string {
  return row.categoryId ?? "__unbudgeted__";
}

export function BudgetVsActual({
  report,
  monthKey,
  currency,
  canEditBudgets = true,
}: {
  report: BudgetReport;
  monthKey: string;
  currency: string;
  canEditBudgets?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const monthOptions = React.useMemo(() => {
    // Anchor on whichever is later: the month being viewed, or the browser's
    // idea of "now". A deep-linked future month must still appear in its own
    // selector, otherwise Radix renders an empty trigger.
    const browserMonth = format(new Date(), "yyyy-MM");
    const anchor = monthKey > browserMonth ? monthKey : browserMonth;
    const keys: string[] = [];
    for (let i = 0; i < MONTH_OPTION_COUNT; i++) {
      keys.push(shiftMonthKey(anchor, -i));
    }
    if (!keys.includes(monthKey)) {
      keys.push(monthKey);
      keys.sort((a, b) => (a < b ? 1 : -1));
    }
    return keys;
  }, [monthKey]);

  function selectMonth(next: string) {
    if (next === monthKey) return;
    // Read the live URL rather than useSearchParams(): the selected month
    // already arrives as a prop, so the URL is only needed to carry sibling
    // params through — and useSearchParams would drag a Suspense/CSR-bailout
    // requirement onto whatever page mounts this section.
    const url = new URL(window.location.href);
    url.searchParams.set("month", next);
    startTransition(() => {
      router.push(`${url.pathname}${url.search}`, { scroll: false });
    });
  }

  const monthSelector = (
    <div className="flex items-center gap-2">
      {pending && (
        <Loader2Icon
          className="size-4 animate-spin text-muted-foreground"
          aria-hidden
        />
      )}
      <Select value={monthKey} onValueChange={selectMonth}>
        <SelectTrigger aria-label="Month" className="min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((key) => (
            <SelectItem key={key} value={key}>
              {monthLabel(key)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const editBudgetsLink = canEditBudgets ? (
    <Button variant="ghost" size="sm" className="gap-1.5" asChild>
      <Link href="/money/budgets">
        <PencilIcon className="size-3.5" aria-hidden />
        Edit budgets
      </Link>
    </Button>
  ) : null;

  return (
    <section
      aria-labelledby="budget-vs-actual-heading"
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground">
            <ScaleIcon className="size-4" aria-hidden />
          </span>
          <div>
            <h2
              id="budget-vs-actual-heading"
              className="font-medium leading-tight"
            >
              Monthly Budget vs. Actual
            </h2>
            <p className="text-xs text-muted-foreground">
              {monthLabel(monthKey)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {monthSelector}
          {editBudgetsLink}
        </div>
      </div>

      {report.rows.length === 0 ? (
        <EmptyState
          icon={ChartColumnBigIcon}
          title="Nothing to compare yet"
          description={`No budgets and no expenses in ${monthLabel(monthKey)}. Set a category budget, then spending will line up against it here.`}
          className="mt-4 py-10"
          action={
            canEditBudgets ? (
              <Button asChild>
                <Link href="/money/budgets">Set up budgets</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cn("transition-opacity", pending && "opacity-60")}>
          <Totals report={report} currency={currency} />
          <BreakdownTable report={report} currency={currency} />
          <SpendingShare report={report} currency={currency} />
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ totals */

function Totals({
  report,
  currency,
}: {
  report: BudgetReport;
  currency: string;
}) {
  const tone = statusTone(report.status);
  const overall = report.pctUsed;

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total expense budget">
          <Money value={report.totalBudget} currency={currency} />
        </Stat>
        <Stat label="Actual expenses">
          <Money value={report.totalActual} currency={currency} />
        </Stat>
        {/*
          `remaining` is null when nothing is budgeted, and that is NOT zero:
          printing "Over budget ₱6,500" for a person who never set a budget
          invents an overspend out of ordinary spending, and would sit here
          contradicting the "No Budget" pill and the "—" percentage derived
          from the same report.
        */}
        <Stat
          label={
            report.remaining !== null && report.remaining < 0
              ? "Over budget"
              : "Remaining budget"
          }
          valueClass={
            report.remaining !== null && report.remaining < 0
              ? "text-error"
              : undefined
          }
        >
          {report.remaining === null ? (
            <span className="tnum text-muted-foreground">—</span>
          ) : (
            <Money
              value={Math.abs(report.remaining)}
              currency={currency}
            />
          )}
        </Stat>
        <Stat label="Budget used" valueClass={tone.text}>
          <span className="tnum">
            {overall === null ? "—" : formatPct(overall)}
          </span>
        </Stat>
      </div>

      {overall !== null && (
        <div className="mt-3">
          <div
            className="h-2 overflow-hidden rounded-full bg-secondary"
            aria-hidden
          >
            <div
              className={cn("h-full rounded-full transition-all", tone.bar)}
              style={{ width: `${clampPercent(overall)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {formatPct(overall)} of the total expense budget used —{" "}
            {statusLabel(report.status).toLowerCase()}.
          </p>
        </div>
      )}

      {report.unbudgetedActual > 0 && (
        <p className="tnum mt-2 text-xs text-muted-foreground">
          <Money value={report.unbudgetedActual} currency={currency} /> of this
          month&rsquo;s spending sits outside any budget.
        </p>
      )}

      {/*
        Savings is a separate commitment, not an expense allotment. Folding it
        into "Total expense budget" would inflate the budget the table compares
        against and quietly make every category look healthier than it is.
      */}
      {report.savingsTarget > 0 && (
        <div className="mt-3 rounded-lg bg-secondary/40 px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <PiggyBankIcon className="size-3.5 text-success" aria-hidden />
              Savings target (separate from the expense budget)
            </span>
            <span className="tnum font-medium">
              <Money value={report.savingsFunded} currency={currency} /> /{" "}
              <Money value={report.savingsTarget} currency={currency} />
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{
                width: `${clampPercent(
                  (report.savingsFunded / report.savingsTarget) * 100,
                )}%`,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Not counted in the totals above or in the table below.
          </p>
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  valueClass,
  children,
}: {
  label: string;
  valueClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-secondary/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {/*
        No `fht-amount` on this wrapper. That class is the privacy marker, not a
        type style: globals.css blanks ANY element carrying it and paints
        "••••••" over the whole box whenever "Hide sensitive info" is on. One of
        these tiles holds a percentage, which carries no amount and is printed
        unmasked twice elsewhere on this same screen — masking it here achieved
        nothing except hiding the number and its over-budget colour. The money
        tiles are unaffected: <Money> marks and masks itself, and without the
        wrapper's overlay on top of it, its currency symbol survives too.
      */}
      <p className={cn("mt-0.5 text-sm font-medium", valueClass)}>{children}</p>
    </div>
  );
}

/* ------------------------------------------------------------------- table */

/**
 * GRAPH 1 of 2 lives inside this table, in the "Budget Used %" column: one bar
 * per category measuring that category against its OWN budget. The bar is
 * capped at 100% so an overspend can't blow the column out, but the number
 * beside it stays uncapped (130% prints as 130%).
 */
function BreakdownTable({
  report,
  currency,
}: {
  report: BudgetReport;
  currency: string;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-medium">Category breakdown</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Every category measured against its own budget for the month.
      </p>

      {/* The table is wider than a phone; it scrolls inside this box so the
          page body itself never picks up a horizontal scrollbar.

          Every cell inside is static text, so the box holds nothing focusable
          and needs its own tab stop: without one, a keyboard-only user on an
          engine that hasn't shipped focusable scrollers (Safari) can never
          bring the last two columns — Budget Used % and Status, the two that
          answer "am I over?" — into view at phone widths. */}
      <div
        role="region"
        aria-label="Category breakdown"
        tabIndex={0}
        className="mt-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left align-bottom">
              <Th className="text-left">Category</Th>
              <Th>Monthly Budget</Th>
              <Th>Actual Expenses</Th>
              <Th>Remaining / Over Budget</Th>
              <Th>
                Budget Used %
                <span className="mt-0.5 block font-normal normal-case tracking-normal text-muted-foreground">
                  of its own budget
                </span>
              </Th>
              <Th className="text-left">Status</Th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <BreakdownRow key={rowKey(row)} row={row} currency={currency} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-medium">
              {/* A row header, like every body row — a screen reader jumping
                  cell by cell into this row would otherwise hear "Actual
                  Expenses, ₱23,000" with nothing saying it is the total. */}
              <th scope="row" className="py-2.5 pr-3 text-left">
                Total
              </th>
              <td className="py-2.5 pr-3 text-right">
                <Money value={report.totalBudget} currency={currency} />
              </td>
              <td className="py-2.5 pr-3 text-right">
                <Money value={report.totalActual} currency={currency} />
              </td>
              <td
                className={cn(
                  "py-2.5 pr-3 text-right whitespace-nowrap",
                  report.remaining !== null &&
                    report.remaining < 0 &&
                    "text-error",
                )}
              >
                {report.remaining === null ? (
                  <span className="tnum text-muted-foreground">—</span>
                ) : report.remaining < 0 ? (
                  <>
                    <Money value={-report.remaining} currency={currency} /> over
                  </>
                ) : (
                  <Money value={report.remaining} currency={currency} />
                )}
              </td>
              <td className="tnum py-2.5 pr-3 text-right">
                {report.pctUsed === null ? "—" : formatPct(report.pctUsed)}
              </td>
              <td className="py-2.5">
                <StatusPill status={report.status} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Th({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "py-2 pr-3 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function BreakdownRow({
  row,
  currency,
}: {
  row: BudgetReportRow;
  currency: string;
}) {
  const tone = statusTone(row.status);
  const isUnbudgeted = row.categoryId === null;
  const hasBudget = row.budget !== null && row.remaining !== null;
  const over = hasBudget && (row.remaining as number) < 0;

  return (
    <tr
      className={cn(
        "border-b border-border/60 last:border-b-0",
        isUnbudgeted && "bg-secondary/30",
      )}
    >
      <th
        scope="row"
        className="py-2.5 pr-3 text-left font-normal whitespace-nowrap"
      >
        {row.categoryName}
        {isUnbudgeted && (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            Spending with no budget set
          </span>
        )}
      </th>

      {/*
        The amount cells deliberately carry NO `fht-amount`. <Money> marks and
        masks itself, and it drops the marker while masked precisely so the CSS
        overlay does not fire a second time. On a right-aligned cell that second
        overlay is not a no-op: it is `inset: 0` with flex-start alignment, so
        the bullets paint at the LEFT edge of a text-right column, and because
        it blanks the whole cell it also erases the word "over" and the error
        red beside the amount.
      */}
      <td className="py-2.5 pr-3 text-right">
        {row.budget === null ? (
          <span className="text-muted-foreground">No Budget</span>
        ) : (
          <Money value={row.budget} currency={currency} />
        )}
      </td>

      <td className="py-2.5 pr-3 text-right">
        <Money value={row.actual} currency={currency} />
      </td>

      <td
        className={cn(
          "py-2.5 pr-3 text-right whitespace-nowrap",
          over && "text-error",
        )}
      >
        {!hasBudget ? (
          <span className="tnum text-muted-foreground">—</span>
        ) : over ? (
          <>
            <Money value={-(row.remaining as number)} currency={currency} />{" "}
            over
          </>
        ) : (
          <Money value={row.remaining as number} currency={currency} />
        )}
      </td>

      {/* GRAPH 1: budget-usage bar, capped at 100%; the printed % is uncapped. */}
      <td className="py-2.5 pr-3 text-right">
        {row.pctUsed === null ? (
          <span className="tnum text-muted-foreground">—</span>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <div
              className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-secondary"
              aria-hidden
            >
              <div
                className={cn("h-full rounded-full transition-all", tone.bar)}
                style={{ width: `${clampPercent(row.pctUsed)}%` }}
              />
            </div>
            <span className={cn("tnum w-12 text-right", tone.text)}>
              {formatPct(row.pctUsed)}
            </span>
          </div>
        )}
      </td>

      <td className="py-2.5">
        <StatusPill status={row.status} />
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: BudgetStatus }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        statusTone(status).pill,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

/* ------------------------------------------------------------------- share */

/**
 * GRAPH 2 of 2, deliberately unlike graph 1: it sits in its own section below
 * the table, it is one stacked bar plus a ranked list rather than a bar per
 * row, and it uses the neutral chart ramp instead of the status colours. The
 * denominator is total monthly spending, NOT any budget — a reader who
 * confuses this with "budget used" would draw the opposite conclusion about
 * their month, so both the heading and the column say which denominator is in
 * play.
 */
function SpendingShare({
  report,
  currency,
}: {
  report: BudgetReport;
  currency: string;
}) {
  const slices = React.useMemo(
    () =>
      report.rows
        .filter((r) => r.actual > 0)
        .sort((a, b) => b.actual - a.actual)
        .map((row, i) => ({
          row,
          color: SHARE_PALETTE[i % SHARE_PALETTE.length],
        })),
    [report.rows],
  );

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <ChartPieIcon className="size-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-medium">Share of Total Monthly Expenses</h3>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        What slice of everything you spent this month went to each category.
        These percentages add up to 100% and have nothing to do with budgets.
      </p>

      {slices.length === 0 ? (
        <p className="mt-3 rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          No expenses recorded this month yet.
        </p>
      ) : (
        <>
          <div
            className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-secondary"
            aria-hidden
          >
            {slices.map(({ row, color }) => (
              <div
                key={rowKey(row)}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${clampPercent(row.sharePct)}%`,
                  backgroundColor: color,
                }}
              />
            ))}
          </div>

          <ul className="mt-3 space-y-1.5">
            {slices.map(({ row, color }) => (
              <li
                key={rowKey(row)}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <span className="truncate">{row.categoryName}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-muted-foreground">
                    <Money value={row.actual} currency={currency} />
                  </span>
                  <span className="tnum w-14 text-right font-medium">
                    {formatPct(row.sharePct)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="tnum mt-3 text-xs text-muted-foreground">
            Total spent:{" "}
            <span className="font-medium text-foreground">
              <Money value={report.totalActual} currency={currency} />
            </span>
          </p>
        </>
      )}
    </div>
  );
}
