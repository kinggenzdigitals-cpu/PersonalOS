"use client";

import { AlertTriangleIcon, PiggyBankIcon } from "lucide-react";
import { FormSheet } from "@/components/money/form-sheet";
import { AccountForm } from "@/components/money/account-form";
import { useReference } from "@/components/providers/reference-provider";
import { useProfile } from "@/components/providers/profile-provider";
import { formatMoney } from "@/lib/format";
import { ACCOUNT_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AccountBalance } from "@/lib/supabase/types";

export function AccountCard({ balance }: { balance: AccountBalance }) {
  const { accounts } = useReference();
  const profile = useProfile();
  const account = accounts.find((a) => a.id === balance.id);
  const typeLabel =
    ACCOUNT_TYPES.find((t) => t.value === balance.type)?.label ?? balance.type;

  const threshold =
    account?.low_balance_threshold ?? profile.low_balance_threshold;
  const low = balance.is_spending && Number(balance.balance) < threshold;

  return (
    <FormSheet
      title="Edit account"
      trigger={
        <button
          type="button"
          className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-medium">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: account?.color ?? "var(--sage)" }}
                />
                <span className="truncate">{balance.name}</span>
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {typeLabel}
                {!balance.is_spending && (
                  <span className="inline-flex items-center gap-0.5 text-sage">
                    <PiggyBankIcon className="size-3" /> Savings
                  </span>
                )}
              </p>
            </div>
            {low && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning"
                title="Low balance"
              >
                <AlertTriangleIcon className="size-3" /> Low
              </span>
            )}
          </div>
          <p
            className={cn(
              "tnum mt-3 font-display text-xl",
              Number(balance.balance) < 0 && "text-money-down",
            )}
          >
            {formatMoney(Number(balance.balance), profile.currency)}
          </p>
        </button>
      }
    >
      {(close) =>
        account ? (
          <AccountForm initial={account} onDone={close} />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            This account can&apos;t be edited right now.
          </p>
        )
      }
    </FormSheet>
  );
}
