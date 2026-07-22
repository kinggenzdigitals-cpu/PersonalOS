"use client";

import {
  PlusIcon,
  ArrowLeftRightIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { FormSheet } from "@/components/money/form-sheet";
import { AccountForm } from "@/components/money/account-form";
import { TransferForm } from "@/components/money/transfer-form";
import { AdjustmentForm } from "@/components/money/adjustment-form";
import { useReference } from "@/components/providers/reference-provider";

function ActionButton({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-xs font-medium shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-5 text-brand" aria-hidden />
      {label}
    </button>
  );
}

export function MoneyQuickActions() {
  const { accounts } = useReference();
  const hasTwo = accounts.length >= 2;

  return (
    <div className="flex gap-2">
      <FormSheet
        title="Add account"
        trigger={<ActionButton icon={PlusIcon} label="Add account" />}
      >
        {(close) => <AccountForm onDone={close} />}
      </FormSheet>

      <FormSheet
        title="Transfer between accounts"
        trigger={<ActionButton icon={ArrowLeftRightIcon} label="Transfer" />}
      >
        {(close) =>
          hasTwo ? (
            <TransferForm onDone={close} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Add a second account to move money between them.
            </p>
          )
        }
      </FormSheet>

      <FormSheet
        title="Adjust a balance"
        trigger={
          <ActionButton icon={SlidersHorizontalIcon} label="Adjust" />
        }
      >
        {(close) => <AdjustmentForm onDone={close} />}
      </FormSheet>
    </div>
  );
}
