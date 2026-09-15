import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * PayMongo webhook signature verification.
 *
 * Header:  Paymongo-Signature: t=<timestamp>,te=<test sig>,li=<live sig>
 * Signed:  `${t}.${rawBody}` — the RAW request body, byte for byte.
 * Scheme:  HMAC-SHA256 keyed with the webhook endpoint's secret.
 *
 * `te` is the valid half in test mode and `li` in live mode. The caller picks
 * the mode from the configured secret key, never from the payload, so a
 * test-mode event can't be replayed against a live deployment.
 *
 * The route must read request.text() and call this BEFORE parsing JSON —
 * re-serialising the body changes its bytes and breaks every real signature.
 */

export function parseSignatureHeader(
  header: string | null | undefined,
): { t: string; te: string; li: string } | null {
  if (!header) return null;
  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const i = piece.indexOf("=");
    if (i <= 0) continue;
    parts[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
  }
  if (!parts.t || !/^\d+$/.test(parts.t)) return null;
  return { t: parts.t, te: parts.te ?? "", li: parts.li ?? "" };
}

export function computeSignature(
  timestamp: string,
  rawBody: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export function verifyPaymongoSignature(opts: {
  header: string | null | undefined;
  rawBody: string;
  secret: string;
  live: boolean;
}): boolean {
  if (!opts.secret) return false;
  const parsed = parseSignatureHeader(opts.header);
  if (!parsed) return false;

  const received = (opts.live ? parsed.li : parsed.te).toLowerCase();
  if (!/^[0-9a-f]+$/.test(received)) return false;

  const expected = computeSignature(parsed.t, opts.rawBody, opts.secret);
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on unequal lengths, and a length mismatch is
  // already a definitive "no".
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
