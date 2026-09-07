"use client";

import * as React from "react";
import {
  ActivityIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ChevronDownIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FinancialHealth } from "@/lib/financial-health";

/**
 * Transparent 0–100 health score. Every contributing factor is listed with the
 * points it earned and a plain-language reason — nothing about the number is
 * hidden from the user.
 */
export function HealthScoreCard({ health }: { health: FinancialHealth }) {
  const [open, setOpen] = React.useState(false);
  const { score, grade, positives, needsAttention, factors, known } = health;

  const tone =
    !known || score < 50
      ? "text-muted-foreground"
      : score >= 85
        ? "text-success"
        : score >= 70
          ? "text-success"
          : "text-warning";
  const ring =
    !known ? "var(--muted-foreground)"
      : score >= 70 ? "var(--success)"
        : score >= 50 ? "var(--warning)"
          : "var(--error)";

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div
          className="relative grid size-14 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(${ring} ${known ? score * 3.6 : 0}deg, var(--secondary) 0deg)`,
          }}
        >
          <span className="grid size-11 place-items-center rounded-full bg-card">
            <span className={cn("tnum text-sm font-semibold", tone)}>
              {known ? score : "—"}
            </span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-medium leading-tight">
            <ActivityIcon className="size-4 text-muted-foreground" aria-hidden />
            Financial health
          </p>
          <p className="text-xs text-muted-foreground">
            {known ? `${grade} · ${score} / 100` : "Not enough data yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          Details
          <ChevronDownIcon
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {!open && known && (
        <div className="mt-3 space-y-1">
          {positives.slice(0, 2).map((f) => (
            <p
              key={f.key}
              className="flex items-start gap-1.5 text-xs text-muted-foreground"
            >
              <CheckCircle2Icon
                className="mt-0.5 size-3.5 shrink-0 text-success"
                aria-hidden
              />
              {f.detail}
            </p>
          ))}
          {needsAttention.slice(0, 2).map((f) => (
            <p
              key={f.key}
              className="flex items-start gap-1.5 text-xs text-muted-foreground"
            >
              <AlertTriangleIcon
                className="mt-0.5 size-3.5 shrink-0 text-warning"
                aria-hidden
              />
              {f.detail}
            </p>
          ))}
        </div>
      )}

      {open && (
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {factors.map((f) => (
            <li key={f.key} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "font-medium",
                    f.status === "unknown" && "text-muted-foreground",
                  )}
                >
                  {f.label}
                </span>
                <span className="tnum shrink-0 text-muted-foreground">
                  {f.status === "unknown" ? "—" : `${f.points}/${f.max}`}
                </span>
              </div>
              <p className="mt-0.5 text-muted-foreground">{f.detail}</p>
            </li>
          ))}
          <li className="pt-1 text-[11px] text-muted-foreground">
            Factors you haven&rsquo;t set up yet are excluded from the score
            rather than counted against you.
          </li>
        </ul>
      )}
    </div>
  );
}
