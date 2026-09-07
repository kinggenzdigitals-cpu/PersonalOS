/**
 * Matching an imported bank row against a transaction the user already entered
 * by hand. Pure and client-safe so the same scoring runs on the server and in
 * the review UI.
 *
 * The bar is deliberately high. A false "possible match" costs the user a
 * moment's attention; a wrongly-merged transaction costs them a correct ledger.
 * So: the amount must match exactly, the account must match, and the date must
 * be close. Merchant text only ever RAISES confidence — it never creates a
 * match on its own, because bank descriptors ("SHELL SERVICE STATION 1234")
 * rarely resemble what a person types ("Shell Fuel").
 */

export type MatchState = "matched" | "possible" | "review";

export type Candidate = {
  id: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  merchant: string;
  type: string;
  accountId: string;
};

export type ScoredMatch = {
  candidate: Candidate;
  score: number; // 0–100
  state: MatchState;
  daysApart: number;
  reasons: string[];
};

/** Words too generic to count as evidence of the same merchant. */
const STOPWORDS = new Set([
  "the", "and", "inc", "corp", "co", "ltd", "philippines", "ph", "store",
  "payment", "purchase", "pos", "debit", "credit", "card", "transaction",
  "ref", "branch", "city", "makati", "manila", "qc",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * Token overlap, 0–1, as a SYMMETRIC Dice coefficient: 2·shared / (|A| + |B|).
 *
 * The denominator matters enormously here. Dividing by the smaller set — which
 * this originally did, to be generous to short human entries — gives a perfect
 * 1.0 to any one-word entry that appears anywhere in a long bank descriptor.
 * "Gas" vs "PETRON GAS STATION EDSA" scored 1.0 and was promoted to the
 * strongest, delete-by-default label, so two unrelated same-price fill-ups on
 * one day could destroy a real transaction with a single click.
 *
 * Dice separates the two cases properly:
 *   "Gas" / "PETRON GAS STATION EDSA"          -> 2·1/(1+4) = 0.40  (weak)
 *   "SM Supermarket" / "SM SUPERMARKET MAKATI" -> 2·1/(1+1) = 1.00  (strong)
 */
export function merchantSimilarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) {
    if (tb.has(t)) {
      shared++;
      continue;
    }
    for (const u of tb) {
      if (nearPrefix(t, u)) {
        shared += 0.75;
        break;
      }
    }
  }
  return Math.min(1, (2 * shared) / (ta.size + tb.size));
}

/**
 * Two tokens that are near-certainly the same word.
 *
 * A plain startsWith is not enough: "supermarket" and "supermart" diverge at
 * the 9th character, so neither is a prefix of the other, yet they are plainly
 * the same merchant. Comparing the SHARED prefix against the shorter token
 * catches that while still rejecting "petron"/"pepsi" (2 shared) and
 * "jollibee"/"jollof" (4 shared).
 */
export function nearPrefix(a: string, b: string): boolean {
  const shorter = Math.min(a.length, b.length);
  if (shorter < 5) return false;
  let i = 0;
  while (i < shorter && a[i] === b[i]) i++;
  return i >= 5 && i / shorter >= 0.7;
}

export function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((da - db) / 86_400_000));
}

/** Money compared in centavos — never trust float equality on currency. */
export function sameAmount(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

export const MAX_DAYS_APART = 4;

/**
 * Similarity required for the strongest "matched" label, which the UI wires to
 * a delete-by-default button.
 *
 * Set above 0.667 deliberately: one generic word overlapping a two-word
 * descriptor ("Load" vs "GLOBE LOAD 100", "Mercury" vs "MERCURY DRUG STORE")
 * scores exactly 2/3, and that is not enough evidence to pre-select deleting
 * someone's transaction. Substantially-identical descriptions score 1.0.
 */
export const MATCH_SIMILARITY = 0.7;

/**
 * Score one imported row against one manual candidate. Returns null when they
 * cannot be the same transaction at all.
 */
export function scoreMatch(
  imported: Candidate,
  candidate: Candidate,
): ScoredMatch | null {
  if (imported.id === candidate.id) return null;
  if (imported.accountId !== candidate.accountId) return null;
  if (imported.type !== candidate.type) return null;
  if (!sameAmount(imported.amount, candidate.amount)) return null;

  const daysApart = daysBetween(imported.date, candidate.date);
  if (daysApart > MAX_DAYS_APART) return null;

  const reasons: string[] = ["Same amount", "Same account"];

  // Date proximity: same day is strong, a few days apart is normal because
  // card purchases post later than they happen.
  let score = 55;
  if (daysApart === 0) {
    score += 25;
    reasons.push("Same date");
  } else {
    score += Math.max(0, 20 - daysApart * 5);
    reasons.push(`${daysApart} day${daysApart === 1 ? "" : "s"} apart`);
  }

  const similarity = merchantSimilarity(imported.merchant, candidate.merchant);
  if (similarity >= 0.6) {
    score += 20;
    reasons.push("Merchant looks the same");
  } else if (similarity > 0) {
    score += 10;
    reasons.push("Merchant partly matches");
  }

  score = Math.min(100, Math.round(score));

  // "matched" is the strongest label and the UI wires it to a delete-by-default
  // button, so it demands real evidence: same day AND at least two shared
  // merchant words.
  //
  // Similarity alone is not enough. It divides by the SMALLER token set, so a
  // one-word manual entry that appears anywhere in the bank descriptor scores
  // a perfect 1.0 — "Gas" vs "PETRON GAS STATION EDSA". Two unrelated ₱500
  // fill-ups on the same day would then be offered as certainly-identical, and
  // one click would delete a real transaction.
  const state: MatchState =
    daysApart === 0 && similarity >= MATCH_SIMILARITY
      ? "matched"
      : score >= 70
        ? "possible"
        : "review";

  return { candidate, score, state, daysApart, reasons };
}

/** Best candidate for an imported row, or null if nothing plausibly matches. */
export function bestMatch(
  imported: Candidate,
  candidates: Candidate[],
): ScoredMatch | null {
  let best: ScoredMatch | null = null;
  for (const c of candidates) {
    const m = scoreMatch(imported, c);
    if (!m) continue;
    if (!best || m.score > best.score) best = m;
  }
  return best;
}

/**
 * Pair imported rows to manual candidates so each manual row is claimed AT
 * MOST ONCE, strongest match first.
 *
 * Matching each imported row independently let one manual entry be offered as
 * the duplicate of several imported rows: confirming each pair in turn would
 * delete several genuinely distinct transactions against a single hand-entered
 * one. Two ₱150 Grab rides with one logged by hand is enough to trigger it.
 */
export function assignMatches<T extends { id: string }>(
  imported: (T & { candidate: Candidate })[],
  candidates: Candidate[],
): { item: T; match: ScoredMatch }[] {
  const scored: { item: T; match: ScoredMatch }[] = [];
  for (const row of imported) {
    for (const c of candidates) {
      const m = scoreMatch(row.candidate, c);
      if (m) scored.push({ item: row, match: m });
    }
  }
  // Strongest first, then a stable tiebreak so the result is deterministic.
  scored.sort(
    (a, b) =>
      b.match.score - a.match.score ||
      a.match.candidate.id.localeCompare(b.match.candidate.id),
  );

  const usedCandidates = new Set<string>();
  const usedImported = new Set<string>();
  const out: { item: T; match: ScoredMatch }[] = [];
  for (const s of scored) {
    if (usedImported.has(s.item.id)) continue;
    if (usedCandidates.has(s.match.candidate.id)) continue;
    usedImported.add(s.item.id);
    usedCandidates.add(s.match.candidate.id);
    out.push(s);
  }
  return out;
}
