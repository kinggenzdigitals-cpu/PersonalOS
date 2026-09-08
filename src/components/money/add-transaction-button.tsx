"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/money/form-sheet";
import { TransactionForm } from "@/components/money/transaction-form";
import { useReference } from "@/components/providers/reference-provider";

export function AddTransactionButton() {
  const router = useRouter();
  const { accounts } = useReference();

  /**
   * Close the sheet, then re-run the server render.
   *
   * Everything this page shows about the month — the budget vs. actual table,
   * the totals block and both graphs — is derived on the server from the
   * month's transactions, so a freshly saved expense stays invisible until the
   * route re-renders. TransactionForm refreshes for its own list as well; doing
   * it here keeps this page correct on its own terms instead of depending on a
   * sibling component's side effect.
   */
  function handleDone(close: () => void) {
    close();
    router.refresh();
  }

  return (
    <FormSheet
      title="New transaction"
      /**
       * A plain <Button> on purpose. FormSheet hands this to Radix's
       * `DialogTrigger asChild`, which opens the dialog by CLONING the child
       * with an `onClick` (plus `ref`, `aria-*` and `data-state`). A custom
       * wrapper that destructures its props without spreading them onto the
       * real <button> swallows that onClick — the exact bug that shipped here
       * in money-quick-actions, where every button rendered perfectly and did
       * nothing at all when clicked.
       */
      trigger={
        <Button size="lg">
          <PlusIcon className="size-4" aria-hidden /> Add Transaction
        </Button>
      }
    >
      {(close) =>
        accounts.length > 0 ? (
          <TransactionForm
            defaultType="expense"
            allowTypeToggle
            onDone={() => handleDone(close)}
          />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Add an account first — a transaction has to be recorded against one.
          </p>
        )
      }
    </FormSheet>
  );
}
