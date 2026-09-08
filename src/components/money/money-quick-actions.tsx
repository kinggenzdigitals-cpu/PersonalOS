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
import { cn } from "@/lib/utils";

/**
 * The button face for one quick action.
 *
 * It MUST forward every prop it is given to the real <button>. FormSheet passes
 * this straight to Radix's `DialogTrigger asChild`, which opens the dialog by
 * cloning its child with an `onClick` (plus `ref`, `aria-*` and `data-state`).
 * Swallowing those props — the original bug here — left all three buttons
 * rendering perfectly and doing absolutely nothing when clicked.
 */
function ActionButton({
  icon: Icon,
  label,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-xs font-medium shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Icon className="size-5 text-brand" aria-hidden />
      {label}
    </button>
  );
}

export function MoneyQuickActions() {
  const { accounts } = useReference();
  const hasOne = accounts.length >= 1;
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
        {(close) =>
          hasOne ? (
            <AdjustmentForm onDone={close} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Add an account first — there&apos;s nothing to adjust yet.
            </p>
          )
        }
      </FormSheet>
    </div>
  );
}
