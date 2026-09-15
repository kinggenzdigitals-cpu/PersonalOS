/**
 * Pulls what the webhook needs out of a PayMongo event, defensively. Pure and
 * dependency-free (the test harness compiles it alone). Everything is typed
 * `unknown` on the way in because it came off the network — the signature has
 * been checked by then, but the shape still hasn't.
 *
 * Event envelope (PayMongo docs, Webhooks → Events):
 *   { data: { id: "evt_…", attributes: { type, livemode, data: <resource> } } }
 * For checkout_session.payment.paid the resource is the Checkout Session:
 *   { id: "cs_…", attributes: { reference_number, metadata, payments: [...] } }
 * Amounts are integers in centavos.
 */

export type PaidCheckout = {
  eventId: string;
  sessionId: string;
  livemode: boolean;
  reference: string;
  /** What checkout charged, from metadata the server set; null if absent. */
  expectedCentavos: number | null;
  /** Sum of the session's payments whose status is "paid". */
  paidCentavos: number;
  /** At least one paid payment, and every paid payment in PHP. */
  currencyOk: boolean;
  paymentId: string | null;
};

type Json = Record<string, unknown>;

const obj = (value: unknown): Json | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;

const str = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

export function eventType(body: unknown): string | null {
  return str(obj(obj(obj(body)?.data)?.attributes)?.type);
}

export function readPaidCheckout(body: unknown): PaidCheckout | null {
  const event = obj(obj(body)?.data);
  const attrs = obj(event?.attributes);
  const eventId = str(event?.id);
  const session = obj(attrs?.data);
  const sessionId = str(session?.id);
  const s = obj(session?.attributes);
  if (!eventId || !attrs || !sessionId || !s) return null;

  const reference = str(s.reference_number);
  if (!reference) return null;

  const expectedRaw = str(obj(s.metadata)?.expected_centavos);
  const expectedCentavos =
    expectedRaw && /^\d{1,12}$/.test(expectedRaw) ? Number(expectedRaw) : null;

  let paidCentavos = 0;
  let anyPaid = false;
  let allPHP = true;
  let paymentId: string | null = null;

  const payments = Array.isArray(s.payments) ? s.payments : [];
  for (const entry of payments) {
    const payment = obj(entry);
    const pa = obj(payment?.attributes);
    if (!pa || pa.status !== "paid") continue;

    const amount = pa.amount;
    // A non-integer or negative amount means the payload isn't what we think
    // it is; refuse the whole event rather than activate on a guess.
    if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0) {
      return null;
    }
    anyPaid = true;
    paidCentavos += amount;
    if (pa.currency !== "PHP") allPHP = false;
    if (paymentId === null) paymentId = str(payment?.id);
  }

  return {
    eventId,
    sessionId,
    livemode: attrs.livemode === true,
    reference,
    expectedCentavos,
    paidCentavos,
    currencyOk: anyPaid && allPHP,
    paymentId,
  };
}

/**
 * True only when exactly the charged amount arrived, in PHP. A partial,
 * inflated, or foreign-currency payment never activates access.
 */
export function amountMatches(checkout: PaidCheckout): boolean {
  return (
    checkout.currencyOk &&
    checkout.expectedCentavos !== null &&
    checkout.paidCentavos > 0 &&
    checkout.paidCentavos === checkout.expectedCentavos
  );
}
