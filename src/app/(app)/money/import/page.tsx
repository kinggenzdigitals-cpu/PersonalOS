import type { Metadata } from "next";
import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { getActivePlan } from "@/lib/queries/billing";
import { getAccounts } from "@/lib/queries/money";
import { PLANS } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CsvImport } from "@/components/money/csv-import";
import { ReconcilePanel } from "@/components/money/reconcile-panel";
import { getReconciliation } from "@/lib/queries/reconcile";
import { WalletIcon } from "lucide-react";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  await requireOnboardedProfile();
  const [plan, accounts] = await Promise.all([getActivePlan(), getAccounts()]);

  // Gated with the same flag as CSV export — enforced again in the server
  // action, since a page-level check is a hint and not a control.
  if (PLANS[plan].limits.csvExport !== true) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand/10 text-brand">
          <SparklesIcon className="size-6" aria-hidden />
        </span>
        <h2 className="mt-3 font-display text-lg">Statement import is a Pro feature</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Upload a CSV from your bank or e-wallet and bring months of history in
          at once, without retyping it.
        </p>
        <Button className="mt-4" asChild>
          <Link href="/subscription">View plans</Link>
        </Button>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={WalletIcon}
        title="Add an account first"
        description="Imported transactions need somewhere to live. Create the account that matches this statement, then come back."
        className="py-10"
        action={
          <Button asChild>
            <Link href="/money">Go to accounts</Link>
          </Button>
        }
      />
    );
  }

  // Imported rows that may duplicate something entered by hand. The 0020
  // fingerprint only stops the same STATEMENT being imported twice.
  const reconciliation = await getReconciliation(50);

  return (
    <div className="space-y-6">
      <CsvImport />

      {(reconciliation.items.length > 0 ||
        reconciliation.unmatchedCount > 0) && (
        <section className="space-y-3">
          <h2 className="font-display text-lg">Reconcile</h2>
          <ReconcilePanel
            items={reconciliation.items}
            unmatchedCount={reconciliation.unmatchedCount}
          />
        </section>
      )}
    </div>
  );
}
