import type { Metadata } from "next";
import { ListIcon, TriangleAlertIcon } from "lucide-react";
import { requireOnboardedProfile } from "@/lib/auth";
import { localDateKey } from "@/lib/date";
import { getTransactions } from "@/lib/queries/money";
import { getMonthlyBudgetReport } from "@/lib/queries/planning";
import { BudgetVsActual } from "@/components/money/budget-vs-actual";
import { TransactionsView } from "@/components/money/transactions-view";
import { MoneySectionHeading } from "@/components/money/money-section-heading";

export const metadata: Metadata = { title: "Transactions" };

/**
 * Normalises `?month=` to a "YYYY-MM" key, falling back to the current month in
 * the user's timezone.
 *
 * The guard has to match `monthKeyToRef` in queries/planning.ts exactly: that
 * one silently treats a malformed key as "current month", so if this function
 * accepted a key the query rejects, the selector would sit on "March 2019"
 * while the table showed today's figures — a wrong answer that looks right.
 *
 * A repeated param (`?month=a&month=b`) arrives as an array; the first value
 * wins rather than the whole thing being discarded.
 */
function resolveMonthKey(
  raw: string | string[] | undefined,
  timezone: string,
): string {
  const candidate = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const match = /^(\d{4})-(\d{2})$/.exec(candidate);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    // Years below 1000 are rejected because Date.UTC folds 0–99 onto 1900–1999.
    if (year >= 1000 && month >= 1 && month <= 12) return candidate;
  }
  return localDateKey(timezone).slice(0, 7);
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // `searchParams` is a promise in Next 16, and the profile read is a round trip
  // of its own — neither depends on the other, so they resolve together.
  const [profile, params] = await Promise.all([
    requireOnboardedProfile(),
    searchParams,
  ]);
  const monthKey = resolveMonthKey(params.month, profile.timezone);

  /*
    Both reads are issued at once. Awaiting the report first would push the
    transaction list a full round trip later on every render of this page, and
    neither query feeds the other.

    The report's rejection handler is attached here, at creation, rather than in
    a `try` around the `await`: a `Promise.all` that rejects on the list would
    otherwise leave the report's rejection unhandled.

    It resolves to `null` instead of rethrowing on purpose. getMonthlyBudgetReport
    throws rather than returning partial figures, and a thrown error here would
    take the transaction list down with it — but the list is still perfectly
    readable when only the budget query failed. What must never happen is the
    third option: rendering the table from an empty report, where "₱0 spent,
    within budget" would look like a calm month rather than a failed query.
  */
  const [report, initial] = await Promise.all([
    getMonthlyBudgetReport(profile.timezone, monthKey).then(
      (r) => r,
      (err: unknown) => {
        console.error("[transactions] budget vs. actual failed", err);
        return null;
      },
    ),
    getTransactions({ limit: 50, offset: 0 }),
  ]);

  return (
    <div className="space-y-5">
      <MoneySectionHeading
        icon={ListIcon}
        title="Transactions"
        description="Everything you've recorded, grouped clearly by date."
      />

      {report ? (
        <BudgetVsActual
          report={report}
          monthKey={monthKey}
          currency={profile.currency}
        />
      ) : (
        <section
          role="alert"
          aria-labelledby="budget-report-error-heading"
          className="rounded-xl border border-error/30 bg-error/5 p-4"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-error/10 text-error">
              <TriangleAlertIcon className="size-4" aria-hidden />
            </span>
            <div>
              <h3
                id="budget-report-error-heading"
                className="text-sm font-medium"
              >
                Budget vs. actual couldn&rsquo;t be loaded
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The comparison for this month failed to load, so it isn&rsquo;t
                shown at all — an empty table would read as &ldquo;nothing
                spent, comfortably within budget&rdquo;, which is not something
                we can vouch for right now. Reload the page to try again. Your
                transactions below are unaffected.
              </p>
            </div>
          </div>
        </section>
      )}

      <TransactionsView initial={initial} timezone={profile.timezone} />
    </div>
  );
}
