"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  Loader2Icon,
  PencilIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSheet } from "@/components/money/form-sheet";
import { useReference } from "@/components/providers/reference-provider";
import { useCurrency } from "@/components/providers/profile-provider";
import { useUpgrade } from "@/components/providers/upgrade-provider";
import { Money, MaskAmounts } from "@/components/ui/money";
import { currencySymbol, clampPercent } from "@/lib/format";
import {
  setMonthlyBudget,
  upsertBudget,
} from "@/app/(app)/money/planning-actions";
import { BUDGET_TEMPLATES, matchTemplateCategory } from "@/lib/budget-templates";
import type { BudgetTemplate } from "@/lib/budget-templates";
import type { BudgetSummary } from "@/lib/queries/planning";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function MonthlyBudgetCard({ summary }: { summary: BudgetSummary }) {
  const currency = useCurrency();
  const {
    hasMonthlyBudget,
    total,
    savingsTarget,
    savingsFunded,
    allocated,
    spent,
    remaining,
    unallocated,
    overallPct,
    periodStart,
    recommendations,
  } = summary;

  const monthLabel = format(new Date(`${periodStart}T00:00:00`), "MMMM yyyy");
  const state = overallPct > 100 ? "over" : overallPct >= 80 ? "warn" : "ok";
  const barColor =
    state === "over"
      ? "bg-error"
      : state === "warn"
        ? "bg-warning"
        : "bg-success";

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground">
            <WalletIcon className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-medium leading-tight">Monthly Budget</p>
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
          </div>
        </div>
        <FormSheet
          title="Monthly budget"
          description="Set your overall budget and required savings for this month."
          trigger={
            <Button variant="ghost" size="sm" className="gap-1.5">
              <PencilIcon className="size-3.5" aria-hidden />
              Edit
            </Button>
          }
        >
          {(close) => <MonthlyBudgetEditor summary={summary} onDone={close} />}
        </FormSheet>
      </div>

      {!hasMonthlyBudget ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Set an overall monthly budget to divide it into allotments and track
            what&rsquo;s allocated, spent and left.
          </p>
          <FormSheet
            title="Monthly budget"
            description="Set your overall budget and required savings for this month."
            trigger={
              <Button className="mt-3">
                <WalletIcon className="size-4" aria-hidden /> Set monthly budget
              </Button>
            }
          >
            {(close) => <MonthlyBudgetEditor summary={summary} onDone={close} />}
          </FormSheet>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-end justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Total budget</p>
              <p className="fht-amount text-2xl font-semibold">
                <Money value={total} currency={currency} />
              </p>
            </div>
            <p className="tnum text-right text-xs text-muted-foreground">
              <Money value={spent} currency={currency} /> spent
              <br />
              {Math.round(overallPct)}% of budget
            </p>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${clampPercent(overallPct)}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Allocated">
              <Money value={allocated} currency={currency} />
            </Stat>
            <Stat label="Spent">
              <Money value={spent} currency={currency} />
            </Stat>
            <Stat label="Remaining">
              <Money value={remaining} currency={currency} />
            </Stat>
            <Stat
              label="Unallocated"
              valueClass={
                unallocated < -0.5
                  ? "text-error"
                  : unallocated > 0.5
                    ? "text-success"
                    : undefined
              }
            >
              <Money value={unallocated} currency={currency} />
            </Stat>
          </div>

          {savingsTarget > 0 && (
            <div className="mt-3 rounded-lg bg-secondary/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <SparklesIcon className="size-3.5 text-success" aria-hidden />
                  Savings allocation
                </span>
                <span className="tnum font-medium">
                  <Money value={savingsFunded} currency={currency} /> /{" "}
                  <Money value={savingsTarget} currency={currency} />
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{
                    width: `${clampPercent((savingsFunded / savingsTarget) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Counted from transfers into your savings accounts this month.
              </p>
            </div>
          )}
        </>
      )}

      {recommendations.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-3">
          {recommendations.map((r, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs text-muted-foreground"
            >
              {r.tone === "warn" ? (
                <AlertTriangleIcon
                  className="mt-0.5 size-3.5 shrink-0 text-warning"
                  aria-hidden
                />
              ) : r.tone === "success" ? (
                <CheckCircle2Icon
                  className="mt-0.5 size-3.5 shrink-0 text-success"
                  aria-hidden
                />
              ) : (
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
              <span>
                <MaskAmounts text={r.text} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
      <p className={cn("fht-amount mt-0.5 text-sm font-medium", valueClass)}>
        {children}
      </p>
    </div>
  );
}

function MonthlyBudgetEditor({
  summary,
  onDone,
}: {
  summary: BudgetSummary;
  onDone: () => void;
}) {
  const router = useRouter();
  const currency = useCurrency();
  const { notify } = useUpgrade();
  const { expenseCategories } = useReference();
  const sym = currencySymbol(currency);

  const [total, setTotal] = React.useState(
    summary.total > 0 ? String(summary.total) : "",
  );
  const [savings, setSavings] = React.useState(
    summary.savingsTarget > 0 ? String(summary.savingsTarget) : "",
  );
  const [saving, setSaving] = React.useState(false);

  const usedCategoryIds = summary.items.map((i) => i.budget.category_id);
  const totalNum = Number.parseFloat(total) || 0;
  const savingsNum = Number.parseFloat(savings) || 0;

  async function save() {
    if (!(totalNum > 0)) return toast.error("Enter your total monthly budget.");
    if (savingsNum > totalNum) {
      return toast.error("Savings can't be more than your total budget.");
    }
    setSaving(true);
    const result = await setMonthlyBudget({
      totalAmount: totalNum,
      savingsTarget: savingsNum,
    });
    if (!result.ok) {
      notify(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Monthly budget saved");
  }

  async function applyTemplate(t: BudgetTemplate) {
    if (!(totalNum > 0)) {
      return toast.error("Enter your total monthly budget first.");
    }
    setSaving(true);

    // Prefill savings from the template's savings line.
    const savingsLine = t.lines.find((l) => l.kind === "savings");
    const templateSavings = round2((savingsLine?.pct ?? 0) * totalNum);

    // Create allotments for matched categories that don't already have one.
    for (const line of t.lines) {
      if (line.kind !== "category") continue;
      const category = matchTemplateCategory(line, expenseCategories);
      if (!category || usedCategoryIds.includes(category.id)) continue;
      const amount = round2(line.pct * totalNum);
      if (!(amount > 0)) continue;
      const res = await upsertBudget({ categoryId: category.id, amount });
      if (!res.ok) {
        notify(res.error);
        setSaving(false);
        router.refresh();
        return;
      }
    }

    const result = await setMonthlyBudget({
      totalAmount: totalNum,
      savingsTarget: templateSavings,
    });
    if (!result.ok) {
      notify(result.error);
      setSaving(false);
      return;
    }
    setSavings(String(templateSavings));
    onDone();
    router.refresh();
    toast.success(`${t.name} template applied`);
  }

  return (
    <div className="space-y-4">
      <MoneyField
        id="mb-total"
        label="Total monthly budget"
        sym={sym}
        value={total}
        onChange={setTotal}
      />
      <MoneyField
        id="mb-savings"
        label="Savings allocation (required)"
        hint="Set aside as savings before other spending — counts toward what's allocated."
        sym={sym}
        value={savings}
        onChange={setSavings}
      />

      {totalNum > 0 && (
        <p className="tnum text-xs text-muted-foreground">
          Unallocated after savings:{" "}
          <span className="font-medium text-foreground">
            <Money value={totalNum - savingsNum} currency={currency} />
          </span>{" "}
          to divide across categories.
        </p>
      )}

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        Save monthly budget
      </Button>

      <div className="rounded-lg border border-border p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <SparklesIcon className="size-4 text-primary" aria-hidden />
          Start from a template
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Prefills category allotments and savings from your total. You can edit
          everything afterward; existing category budgets are left untouched.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {BUDGET_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              disabled={saving}
              className="rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary/40 disabled:opacity-60"
            >
              <p className="text-sm font-medium">{t.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoneyField({
  id,
  label,
  hint,
  sym,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  sym: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          {sym}
        </span>
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.00"
          className="pl-7 tnum"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
