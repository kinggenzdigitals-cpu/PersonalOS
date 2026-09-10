import { cn } from "@/lib/utils";

/**
 * Product proof rendered from sanitized SAMPLE data in the app's own visual
 * language — not stock finance photos, and not a real user's balances.
 *
 * The brief wants the actual product shown; the authenticated app can't be
 * screenshotted here, so these are faithful demo cards built from the same
 * tokens (tnum figures, rounded cards, the real budget-vs-actual bar treatment
 * including a genuinely over-budget row at 130%). Every number is illustrative
 * and labelled as such.
 */

const PESO = (n: number) => `₱${n.toLocaleString("en-PH")}`;

const BUDGET_ROWS = [
  { name: "Food", budget: 6000, actual: 4200 },
  { name: "Transport", budget: 2500, actual: 1850 },
  { name: "Bills", budget: 5000, actual: 6500 }, // over budget on purpose
];

const HABITS = [
  { name: "Morning walk", days: [1, 1, 1, 0, 1, 1, 0] },
  { name: "No-spend day", days: [1, 0, 1, 1, 1, 0, 1] },
  { name: "Read 10 min", days: [1, 1, 1, 1, 1, 1, 1] },
];

export function ProductProof({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {/* Net position */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Net position
        </p>
        <p className="tnum mt-1 font-display text-3xl">₱74,080</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-3/4 rounded-full bg-sage" />
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>Cash ₱58,900</span>
          <span>Owed ₱21,180</span>
          <span>You owe ₱6,000</span>
        </div>
      </div>

      {/* This month */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          This month
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="tnum font-display text-lg text-money-up">+₱42k</p>
            <p className="text-[11px] text-muted-foreground">Income</p>
          </div>
          <div>
            <p className="tnum font-display text-lg text-money-down">−₱28k</p>
            <p className="text-[11px] text-muted-foreground">Spent</p>
          </div>
          <div>
            <p className="tnum font-display text-lg text-sage">₱9k</p>
            <p className="text-[11px] text-muted-foreground">Saved</p>
          </div>
        </div>
      </div>

      {/* Budget vs Actual */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:col-span-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Budget vs. Actual
        </p>
        <ul className="mt-3 space-y-3">
          {BUDGET_ROWS.map((r) => {
            const pct = Math.round((r.actual / r.budget) * 100);
            const over = r.actual > r.budget;
            return (
              <li key={r.name}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium">{r.name}</span>
                  <span
                    className={cn(
                      "tnum",
                      over ? "text-money-down" : "text-muted-foreground",
                    )}
                  >
                    {PESO(r.actual)} / {PESO(r.budget)} · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      over ? "bg-money-down" : "bg-brand",
                    )}
                    // Bar caps at 100% even when spending is over — the printed
                    // percentage above stays truthful (130%).
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Habits */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Habits this week
        </p>
        <ul className="mt-3 space-y-2.5">
          {HABITS.map((h) => (
            <li key={h.name} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm">{h.name}</span>
              <span className="flex gap-1" aria-hidden>
                {h.days.map((d, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-3 rounded-full",
                      d ? "bg-accent-brand" : "bg-secondary",
                    )}
                  />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-xs text-muted-foreground sm:col-span-2">
        Sample data — your own numbers stay private to your account.
      </p>
    </div>
  );
}
