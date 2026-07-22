"use client";

import * as React from "react";
import { currencySymbol } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Large, autofocused amount field. `inputMode="decimal"` surfaces the numeric
 * keypad on mobile. Only digits and a single decimal point are accepted.
 */
export function MoneyAmountInput({
  value,
  onChange,
  currency,
  autoFocus = true,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  currency: string;
  autoFocus?: boolean;
  className?: string;
}) {
  function handle(raw: string) {
    let next = raw.replace(/[^0-9.]/g, "");
    const firstDot = next.indexOf(".");
    if (firstDot !== -1) {
      next =
        next.slice(0, firstDot + 1) +
        next.slice(firstDot + 1).replace(/\./g, "");
      // limit to 2 decimals
      const [whole, dec] = next.split(".");
      next = dec !== undefined ? `${whole}.${dec.slice(0, 2)}` : next;
    }
    onChange(next);
  }

  return (
    <div
      className={cn(
        "flex items-baseline justify-center gap-1 py-2",
        className,
      )}
    >
      <span className="font-display text-3xl text-muted-foreground">
        {currencySymbol(currency)}
      </span>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => handle(e.target.value)}
        placeholder="0.00"
        aria-label="Amount"
        className="tnum w-40 border-0 bg-transparent text-center font-display text-5xl tracking-tight outline-none placeholder:text-muted-foreground/40 focus:ring-0"
      />
    </div>
  );
}
