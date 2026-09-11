/**
 * Reference rate used only to present approximate dual-currency prices.
 * Checkout amounts remain defined in their native currencies in plans.ts and
 * offer-config.ts. Update this rate when the public pricing display is refreshed.
 */
export const PHP_PER_USD_REFERENCE_RATE = 62.542;
export const PHP_PER_USD_REFERENCE_DATE = "September 11, 2026";

export function phpToUsdEstimate(amountPHP: number) {
  return amountPHP / PHP_PER_USD_REFERENCE_RATE;
}

export function usdToPhpEstimate(amountUSD: number) {
  return amountUSD * PHP_PER_USD_REFERENCE_RATE;
}

export function formatUSD(amount: number, fractionDigits = 2) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export function formatPHP(amount: number, maximumFractionDigits = 2) {
  return `₱${amount.toLocaleString("en-PH", { maximumFractionDigits })}`;
}
