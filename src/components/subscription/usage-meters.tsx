import { AlertTriangleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, type PlanId, type PlanLimits } from "@/lib/plans";
import type { Usage } from "@/lib/queries/usage";

type Metric = {
  label: string;
  used: keyof Usage;
  limit: keyof PlanLimits;
};

const METRICS: Metric[] = [
  { label: "Transactions this month", used: "transactions", limit: "transactionsPerMonth" },
  { label: "Wallets / accounts", used: "accounts", limit: "accounts" },
  { label: "Active habits", used: "habits", limit: "habits" },
  { label: "Savings goals", used: "goals", limit: "goals" },
  { label: "Active budgets", used: "budgets", limit: "budgets" },
];

function barColor(pct: number) {
  if (pct >= 100) return "bg-error";
  if (pct >= 90) return "bg-warning";
  if (pct >= 80) return "bg-accent-brand";
  return "bg-brand";
}

export function UsageMeters({ usage, plan }: { usage: Usage; plan: PlanId }) {
  const limits = PLANS[plan].limits;

  return (
    <div className="space-y-3">
      {METRICS.map((m) => {
        const used = usage[m.used];
        const limit = limits[m.limit];
        const cap = typeof limit === "number" ? limit : null;
        const pct = cap && cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
        const atLimit = cap != null && used >= cap;
        const near = cap != null && !atLimit && pct >= 80;

        return (
          <div key={m.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{m.label}</span>
              <span
                className={cn(
                  "tnum font-medium",
                  atLimit
                    ? "text-error"
                    : near
                      ? "text-warning"
                      : "text-muted-foreground",
                )}
              >
                {used}
                {cap != null ? ` of ${cap}` : ""}
              </span>
            </div>
            {cap != null && (
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full transition-all", barColor(pct))}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {atLimit && (
              <p className="flex items-center gap-1 text-xs text-error">
                <AlertTriangleIcon className="size-3.5" /> Limit reached — upgrade
                for more.
              </p>
            )}
            {near && (
              <p className="flex items-center gap-1 text-xs text-warning">
                <AlertTriangleIcon className="size-3.5" /> You&apos;re close to
                your limit.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
