export const MAX_BALANCE = 9_999_999_999.99;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function isValidBalance(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
    && Math.abs(value) <= MAX_BALANCE && Math.round(value * 100) / 100 === value;
}

export function parseBalance(value: string): number | null {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value.trim());
  return isValidBalance(amount) ? amount : null;
}

export type BalancePreview = {
  requestId: string;
  accountId: string;
  asOf: string;
  recordedBalance: number;
  observedBalance: number;
  difference: number;
};

export type SaveComparisonInput = BalancePreview & {
  applyAdjustment: boolean;
  notes: string;
};

export function validComparison(input: SaveComparisonInput): boolean {
  return !!input && isUuid(input.requestId) && isUuid(input.accountId)
    && typeof input.asOf === "string" && Number.isFinite(Date.parse(input.asOf))
    && isValidBalance(input.recordedBalance) && isValidBalance(input.observedBalance)
    && typeof input.applyAdjustment === "boolean"
    && typeof input.notes === "string" && input.notes.length <= 240;
}

export const RECONCILIATION_LABELS = {
  matched: "Matched at comparison",
  adjusted: "Adjustment recorded",
  needs_review: "Needs review",
} as const;
