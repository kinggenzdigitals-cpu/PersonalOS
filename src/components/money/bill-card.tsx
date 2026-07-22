"use client";

import { CheckIcon } from "lucide-react";
import { FormSheet } from "@/components/money/form-sheet";
import { BillForm } from "@/components/money/bill-form";
import { PayBillForm } from "@/components/money/pay-bill-form";
import { useCurrency } from "@/components/providers/profile-provider";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BillWithStatus } from "@/lib/queries/planning";

const STATUS_META = {
  overdue: { label: "Overdue", className: "bg-error/10 text-error" },
  due_soon: { label: "Due soon", className: "bg-warning/10 text-warning" },
  upcoming: { label: "Upcoming", className: "bg-secondary text-muted-foreground" },
} as const;

function dueLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

export function BillCard({ item }: { item: BillWithStatus }) {
  const currency = useCurrency();
  const { bill, status, daysUntilDue, lastPaidDate } = item;
  const meta = STATUS_META[status];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <FormSheet
          title="Edit bill"
          trigger={
            <button
              type="button"
              className="min-w-0 flex-1 text-left focus-visible:outline-none"
            >
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{bill.name}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    meta.className,
                  )}
                >
                  {meta.label}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {dueLabel(daysUntilDue)} · {bill.frequency}
                {lastPaidDate ? ` · last paid ${lastPaidDate}` : ""}
              </p>
            </button>
          }
        >
          {(close) => <BillForm initial={bill} onDone={close} />}
        </FormSheet>

        <span className="tnum shrink-0 font-display text-lg">
          {formatMoney(Number(bill.amount), currency)}
        </span>
      </div>

      <FormSheet
        title={`Pay ${bill.name}`}
        trigger={
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand/10 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CheckIcon className="size-4" /> Mark as paid
          </button>
        }
      >
        {(close) => <PayBillForm bill={bill} onDone={close} />}
      </FormSheet>
    </div>
  );
}
