/**
 * Avatar initials for the account menu.
 *
 * Pure and dependency-free on purpose: the repo's test harness compiles a
 * single file to .tmp-test and runs it under bare node, so anything this
 * imported would have to be compiled alongside it.
 */

/**
 * Word separators: whitespace, underscores, and every dash from U+2010-U+2015
 * plus the ASCII hyphen. Apostrophes are deliberately absent - splitting
 * "O'Brien" would produce "OB", but that name is initialled "O". Hyphens DO
 * split, so "Anne-Marie" reads as "AM" the way people write it themselves.
 */
const SEPARATORS = /[\s_‐-―-]+/;

/**
 * What counts as a usable initial. Digits are allowed alongside letters so a
 * handle-style name ("47 Ronin") gets "4R" instead of falling back to "?".
 */
const USABLE = /[\p{L}\p{N}]/u;

/** First letter/digit of one word, uppercased, or null if the word has none. */
function firstUsable(word: string): string | null {
  // Iterating the string yields whole code points. Indexing would hand back
  // half of a surrogate pair for emoji and other astral characters, which
  // renders as a replacement glyph instead of being skipped.
  for (const ch of word) {
    if (!USABLE.test(ch)) continue;
    // Uppercasing can turn one character into two - "ß" becomes "SS" and
    // the "fi" ligature becomes "FI" - which would blow the two-letter budget,
    // so keep only the first code point of the result.
    const [upper] = ch.toUpperCase();
    return upper ?? ch;
  }
  return null;
}

/**
 * Up to two uppercase letters for `name`, or `fallback` when there is nothing
 * usable in it (empty, whitespace, punctuation- or emoji-only, or null).
 */
export function initialsFrom(
  name: string | null | undefined,
  fallback: string = "?",
): string {
  const letters = (name ?? "")
    .split(SEPARATORS)
    .map(firstUsable)
    .filter((c): c is string => c !== null);

  if (letters.length === 0) return fallback;
  if (letters.length === 1) return letters[0];

  // First + LAST word, not the first two: "King Fenn Gonzales" is "KG". The
  // surname is what identifies a person; middle names are noise, and taking
  // the first two would give everyone with a middle name the wrong initials.
  return letters[0] + letters[letters.length - 1];
}
