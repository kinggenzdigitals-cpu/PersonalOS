import {
  BILLING_PERIODS,
  PLAN_PRICES,
  type BillingPeriod,
} from "@/lib/plans";

export type PaidPlan = "pro" | "premium";

const PAID_PLANS = new Set<string>(["pro", "premium"]);
const BILLING_PERIOD_IDS = new Set<string>(
  BILLING_PERIODS.map((period) => period.id),
);

export function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === "string" && PAID_PLANS.has(value);
}

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return typeof value === "string" && BILLING_PERIOD_IDS.has(value);
}

export function periodMonths(period: BillingPeriod): 1 | 3 | 6 | 12 {
  const months = BILLING_PERIODS.find((item) => item.id === period)?.months;
  if (months !== 1 && months !== 3 && months !== 6 && months !== 12) {
    throw new Error("Unsupported billing period.");
  }
  return months;
}

export function checkoutAmount(plan: PaidPlan, period: BillingPeriod): number {
  return PLAN_PRICES[plan][period].total;
}

export type PaidCallback = {
  externalId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paidAt?: string;
};

export function parsePaidCallback(body: unknown): PaidCallback | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const row = body as Record<string, unknown>;
  if (row.status !== "PAID") return null;

  const externalId = typeof row.external_id === "string" ? row.external_id : "";
  const invoiceId = typeof row.id === "string" ? row.id : "";
  const rawAmount = row.paid_amount ?? row.amount;
  const amount = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
  const currency = typeof row.currency === "string" ? row.currency : "";
  const paidAt = typeof row.paid_at === "string" ? row.paid_at : undefined;

  if (
    !externalId.startsWith("fht_") ||
    !invoiceId ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    currency !== "PHP"
  ) {
    return null;
  }

  return { externalId, invoiceId, amount, currency, paidAt };
}
