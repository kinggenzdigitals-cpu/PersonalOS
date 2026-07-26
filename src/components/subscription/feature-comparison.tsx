import { Fragment } from "react";
import { CheckIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_SECTIONS, type FeatureCell } from "@/lib/plan-features";
import type { PlanId } from "@/lib/plans";

function Cell({ v }: { v: FeatureCell }) {
  if (v === true) {
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <CheckIcon className="size-4" aria-hidden />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (v === false) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground/60">
        <MinusIcon className="size-4" aria-hidden />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span className="tnum">{v}</span>;
}

const COLS: PlanId[] = ["free", "pro", "premium"];

export function FeatureComparison({ currentPlan }: { currentPlan: PlanId }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/40 text-xs">
            <th className="px-3 py-2.5 text-left font-medium">Feature</th>
            {COLS.map((c) => (
              <th
                key={c}
                className={cn(
                  "px-3 py-2.5 text-center font-medium capitalize",
                  currentPlan === c ? "text-brand" : "text-foreground",
                )}
              >
                {c}
                {currentPlan === c && (
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    Current plan
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_SECTIONS.map((section) => (
            <Fragment key={section.title}>
              <tr className="bg-secondary/20">
                <td
                  colSpan={4}
                  className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{row.label}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-center",
                      currentPlan === "free" && "bg-brand/5",
                    )}
                  >
                    <Cell v={row.free} />
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-center",
                      currentPlan === "pro" && "bg-brand/5",
                    )}
                  >
                    <Cell v={row.pro} />
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-center",
                      currentPlan === "premium" && "bg-brand/5",
                    )}
                  >
                    <Cell v={row.premium} />
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
