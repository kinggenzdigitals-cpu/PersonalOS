import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed undo tokens for a just-deleted transaction.
 *
 * Deleting hands the client an opaque token carrying the row that was removed
 * plus an expiry, signed with a server-only key. Undo sends it back, so the
 * restore can put the ORIGINAL row back — same id, same created_at, the fields
 * exactly as they were signed — without trusting the copy the browser held and
 * without spending a slot from this month's plan cap. The client can neither
 * read nor mint one, so restoring is not a way to write a chosen row.
 *
 * Dependency-free apart from node:crypto, with the key and the clock passed in,
 * so scripts/undo-token.test.cjs can exercise every branch.
 */

/** Long enough to outlast the undo toast, short enough to stay a one-shot. */
export const UNDO_TOKEN_TTL_MS = 10 * 60 * 1000;

/** Label so the derived key can never collide with another use of the secret. */
const KEY_LABEL = "undo-token-v1:";

/** The columns a restore puts back, exactly as the delete signed them. */
export type UndoTransaction = {
  id: string;
  user_id: string;
  type: "income" | "expense" | "transfer" | "adjustment";
  amount: number;
  category_id: string | null;
  account_id: string;
  to_account_id: string | null;
  direction: "in" | "out" | null;
  occurred_at: string;
  merchant: string | null;
  notes: string | null;
  created_at: string;
};

type UndoPayload = { exp: number; row: UndoTransaction };

/**
 * A dedicated HMAC key from an existing server secret — one-way, so the token
 * key leaking would not expose the secret it came from.
 */
export function deriveUndoKey(secret: string | undefined | null): string {
  if (!secret) return "";
  return createHash("sha256").update(KEY_LABEL + secret).digest("hex");
}

function sign(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("hex");
}

function matches(received: string, expected: string): boolean {
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on unequal lengths, and a length mismatch is
  // already a definitive "no".
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signUndoToken(
  row: UndoTransaction,
  opts: { key: string; now: number; ttlMs?: number },
): string {
  const payload: UndoPayload = {
    exp: opts.now + (opts.ttlMs ?? UNDO_TOKEN_TTL_MS),
    row,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${body}.${sign(body, opts.key)}`;
}

/**
 * The signed row, or null if the token is missing, tampered with, signed with
 * another key, expired, or belongs to a different user. The signature is
 * checked against the token's own bytes, so any edited field fails it.
 */
export function verifyUndoToken(
  token: string | null | undefined,
  opts: { key: string; now: number; userId: string },
): UndoTransaction | null {
  if (!token || !opts.key || !opts.userId) return null;

  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  if (!matches(token.slice(dot + 1), sign(body, opts.key))) return null;

  let payload: UndoPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || !payload.row) return null;
  if (!(payload.exp > opts.now)) return null;
  if (payload.row.user_id !== opts.userId) return null;
  return payload.row;
}
