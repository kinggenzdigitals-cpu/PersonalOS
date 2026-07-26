"use client";

import { CheckIcon } from "lucide-react";
import { FormSheet } from "@/components/money/form-sheet";
import { LedgerForm } from "@/components/money/ledger-form";
import { SettleLedgerForm } from "@/components/money/settle-ledger-form";
import { useCurrency } from "@/components/providers/profile-provider";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/supabase/types";

export function LedgerCard({
  entry,
  today,
}: {
  entry: LedgerEntry;
  today: string;
}) {
  const currency = useCurrency();
  const receivable = entry.direction === "receivable";
  const overdue = entry.due_date != null && entry.due_date < today;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <FormSheet
          title="Edit entry"
          trigger={
            <button
              type="button"
              className="min-w-0 flex-1 text-left focus-visible:outline-none"
            >
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{entry.party}</span>
                {overdue && (
                  <span className="rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-medium text-error">
                    Overdue
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {entry.due_date ? `Due ${entry.due_date}` : "No due date"}
                {entry.notes ? ` · ${entry.notes}` : ""}
              </p>
            </button>
          }
        >
          {(close) => <LedgerForm initial={entry} onDone={close} />}
        </FormSheet>

        <span
          className={cn(
            "tnum shrink-0 font-display text-lg",
            receivable ? "text-money-up" : "text-money-down",
          )}
        >
          <Money value={Number(entry.amount)} currency={currency} />
        </span>
      </div>

      <FormSheet
        title={receivable ? `Receive from ${entry.party}` : `Pay ${entry.party}`}
        trigger={
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand/10 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CheckIcon className="size-4" />
            {receivable ? "Mark received" : "Mark paid"}
          </button>
        }
      >
        {(close) => <SettleLedgerForm entry={entry} onDone={close} />}
      </FormSheet>
    </div>
  );
}
