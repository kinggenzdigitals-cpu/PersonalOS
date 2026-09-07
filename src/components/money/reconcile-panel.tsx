"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  GitCompareArrowsIcon,
  Loader2Icon,
  CheckCircle2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { useCurrency } from "@/components/providers/profile-provider";
import { cn } from "@/lib/utils";
import {
  keepBoth,
  keepAll,
  mergeDuplicate,
} from "@/app/(app)/money/reconcile-actions";
import type { ReconcileItem } from "@/lib/queries/reconcile";
import { toast } from "sonner";

const STATE_LABEL: Record<string, { text: string; className: string }> = {
  matched: { text: "Very likely the same", className: "bg-error/10 text-error" },
  possible: { text: "Possible match", className: "bg-warning/10 text-warning" },
  review: { text: "Needs review", className: "bg-secondary text-muted-foreground" },
};

/**
 * Review imported rows that look like they duplicate a manual entry.
 * Deliberately never resolves anything on its own — the spec is explicit that
 * nothing is created or merged until the user confirms.
 */
export function ReconcilePanel({
  items,
  unmatchedCount,
}: {
  items: ReconcileItem[];
  unmatchedCount: number;
}) {
  const router = useRouter();
  const currency = useCurrency();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(
    key: string,
    fn: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
      toast.success(res.message ?? "Done.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2Icon className="size-5" aria-hidden />
        </span>
        <p className="mt-3 font-medium">Nothing to reconcile</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {unmatchedCount > 0
            ? `${unmatchedCount} imported transaction${unmatchedCount === 1 ? "" : "s"} had no similar manual entry.`
            : "Imported transactions don't appear to duplicate anything you entered by hand."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-medium">
            <GitCompareArrowsIcon
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            Possible duplicates
          </p>
          <p className="text-xs text-muted-foreground">
            {items.length} imported transaction{items.length === 1 ? "" : "s"}{" "}
            may already exist. Nothing is removed until you choose.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy !== null}
          onClick={() =>
            run("all", () => keepAll(items.map((i) => i.imported.id)))
          }
        >
          {busy === "all" && (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          )}
          Keep all
        </Button>
      </div>

      <ul className="space-y-3">
        {items.map((item) => {
          const badge = STATE_LABEL[item.match.state] ?? STATE_LABEL.review;
          const imp = item.imported;
          const cand = item.match.candidate;
          const rowBusy = busy === imp.id;

          return (
            <li
              key={imp.id}
              className="rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    badge.className,
                  )}
                >
                  {badge.text}
                </span>
                <span className="tnum text-xs text-muted-foreground">
                  {item.match.reasons.join(" · ")}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Side
                  label="From your statement"
                  merchant={imp.merchant || "—"}
                  date={new Date(imp.occurred_at)}
                  amount={Number(imp.amount)}
                  category={item.importedCategory}
                  currency={currency}
                />
                <Side
                  label="You already entered"
                  merchant={cand.merchant || "—"}
                  date={new Date(`${cand.date}T12:00:00Z`)}
                  amount={cand.amount}
                  category={item.candidateCategory}
                  currency={currency}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={rowBusy}
                  onClick={() =>
                    run(imp.id, () =>
                      mergeDuplicate({
                        importedId: imp.id,
                        manualId: cand.id,
                        keep: "imported",
                      }),
                    )
                  }
                >
                  {rowBusy && (
                    <Loader2Icon className="size-4 animate-spin" aria-hidden />
                  )}
                  Keep statement version
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rowBusy}
                  onClick={() =>
                    run(imp.id, () =>
                      mergeDuplicate({
                        importedId: imp.id,
                        manualId: cand.id,
                        keep: "manual",
                      }),
                    )
                  }
                >
                  Keep my entry
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={rowBusy}
                  onClick={() => run(imp.id, () => keepBoth(imp.id))}
                >
                  They&rsquo;re different
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Side({
  label,
  merchant,
  date,
  amount,
  category,
  currency,
}: {
  label: string;
  merchant: string;
  date: Date;
  amount: number;
  category: string | null;
  currency: string;
}) {
  return (
    <div className="rounded-lg bg-secondary/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium">{merchant}</p>
      <p className="tnum mt-0.5 text-xs text-muted-foreground">
        {format(date, "d MMM yyyy")} · <Money value={amount} currency={currency} />
        {category ? ` · ${category}` : ""}
      </p>
    </div>
  );
}
