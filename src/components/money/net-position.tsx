import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";

/**
 * The user's true financial position at a glance:
 *   cash on hand + owed to you − you owe.
 * Ties together accounts, receivables, and payables into one honest number.
 */
export function NetPositionCard({
  cash,
  receivable,
  payable,
  currency,
  available,
}: {
  cash: number;
  receivable: number;
  payable: number;
  currency: string;
  available?: number;
}) {
  const net = cash + receivable - payable;

  return (
    <Card className="shadow-card">
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Net position
        </p>
        <p
          className={cn(
            "tnum font-display text-3xl",
            net < 0 && "text-money-down",
          )}
        >
          <Money value={net} currency={currency} />
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cash plus what you&apos;re owed, minus what you owe
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Piece
            label="Cash on hand"
            value={<Money value={cash} currency={currency} />}
          />
          <Piece
            label="Owed to you"
            value={<Money value={receivable} currency={currency} />}
            tone="up"
            prefix="+"
          />
          <Piece
            label="You owe"
            value={<Money value={payable} currency={currency} />}
            tone="down"
            prefix="−"
          />
        </div>

        {available !== undefined && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Available to spend</span>
            <span className="tnum font-semibold text-sage">
              <Money value={available} currency={currency} />
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Piece({
  label,
  value,
  tone,
  prefix,
}: {
  label: string;
  value: ReactNode;
  tone?: "up" | "down";
  prefix?: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/60 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tnum mt-0.5 text-sm font-semibold",
          tone === "up" && "text-money-up",
          tone === "down" && "text-money-down",
        )}
      >
        {prefix ?? ""}
        {value}
      </p>
    </div>
  );
}
