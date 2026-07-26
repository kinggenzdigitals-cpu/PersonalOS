"use client";

import * as React from "react";
import {
  formatMoney,
  formatMoneyCompact,
  currencySymbol,
  maskAmountsInText,
} from "@/lib/format";
import { subscribe, getHidden, getServerHidden } from "@/lib/privacy-store";
import { cn } from "@/lib/utils";

/** Reactive "hide sensitive info" flag. */
export function usePrivacyHidden(): boolean {
  return React.useSyncExternalStore(subscribe, getHidden, getServerHidden);
}

/**
 * The single money-display component. Renders a formatted amount, or a masked
 * placeholder when "Hide sensitive info" is on. Use everywhere an amount is
 * shown so masking is consistent and centralized.
 */
export function Money({
  value,
  currency = "PHP",
  compact = false,
  sign = false,
  symbol = true,
  className,
}: {
  value: number;
  currency?: string;
  compact?: boolean;
  sign?: boolean;
  symbol?: boolean;
  className?: string;
}) {
  const hidden = usePrivacyHidden();

  if (hidden) {
    const sym = symbol ? currencySymbol(currency) : "";
    return (
      <span className={cn("tnum", className)} aria-label="Hidden">
        {sym}
        ••••••
      </span>
    );
  }

  const text = compact
    ? formatMoneyCompact(value, currency)
    : formatMoney(value, currency, { sign, symbol });
  return <span className={cn("fht-amount", className)}>{text}</span>;
}

/**
 * Masks currency amounts inside a plain string (e.g. "Bill · ₱1,200") when
 * "Hide sensitive info" is on. For text that already has the amount baked in.
 */
export function MaskAmounts({ text }: { text: string | null | undefined }) {
  const hidden = usePrivacyHidden();
  if (!text) return null;
  return <>{hidden ? maskAmountsInText(text) : text}</>;
}
