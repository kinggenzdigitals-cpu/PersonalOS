/** Currency + number formatting helpers. */

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
};

export function currencySymbol(currency = "PHP") {
  return CURRENCY_SYMBOLS[currency] ?? currency + " ";
}

/**
 * Formats an amount with the user's currency symbol and thousands separators.
 * Always two decimals. Pair with `tnum` class for tabular alignment.
 */
export function formatMoney(
  amount: number,
  currency = "PHP",
  opts: { sign?: boolean; symbol?: boolean } = {},
) {
  const { sign = false, symbol = true } = opts;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = symbol ? currencySymbol(currency) : "";
  const signChar = sign ? (amount < 0 ? "−" : "+") : amount < 0 ? "−" : "";
  return `${signChar}${prefix}${formatted}`;
}

/** Compact money for tight spaces (e.g. ₱12.4k). */
export function formatMoneyCompact(amount: number, currency = "PHP") {
  const abs = Math.abs(amount);
  const sym = currencySymbol(currency);
  const sign = amount < 0 ? "−" : "";
  if (abs >= 1_000_000)
    return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

export function clampPercent(n: number) {
  return Math.max(0, Math.min(100, n));
}

/**
 * Masks any currency amounts inside a free-text string (e.g. an alert like
 * "Groceries is over by ₱1,234"). Used with the privacy toggle where the amount
 * is already baked into a sentence. Keeps the currency symbol, hides digits.
 */
export function maskAmountsInText(text: string): string {
  return text.replace(
    /(A\$|C\$|S\$|[₱$€£¥])\s?\d[\d,]*(?:\.\d+)?/g,
    "$1••••••",
  );
}
