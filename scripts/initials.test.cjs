/**
 * Tests for the avatar-initials helper.
 *
 * Run via `npm run test:initials`, which compiles src/lib/initials.ts to
 * .tmp-test first (same approach as the csv and budget-advice suites).
 */
const assert = require("assert");
const { initialsFrom } = require("../.tmp-test/initials.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}\n      ${err.message}`);
  }
}

const eq = (input, expected, fallback) =>
  assert.strictEqual(
    fallback === undefined
      ? initialsFrom(input)
      : initialsFrom(input, fallback),
    expected,
    `initialsFrom(${JSON.stringify(input)}) -> ${JSON.stringify(
      initialsFrom(input, fallback),
    )}, expected ${JSON.stringify(expected)}`,
  );

// ---- the everyday cases ---------------------------------------------------

test("two words give both initials", () => {
  eq("King Gonzales", "KG");
});

test("three words take the first and the LAST, not the first two", () => {
  eq("King Fenn Gonzales", "KG");
  eq("Ada Byron Lovelace", "AL");
});

test("four words still take the outer two", () => {
  eq("Jose Protacio Rizal Mercado", "JM");
});

test("one word gives a single letter", () => {
  eq("King", "K");
});

test("a single character is returned uppercased", () => {
  eq("k", "K");
});

test("output is uppercased regardless of input case", () => {
  eq("king gonzales", "KG");
  eq("kInG gOnZaLeS", "KG");
});

// ---- whitespace -----------------------------------------------------------

test("extra internal and surrounding whitespace is ignored", () => {
  eq("  king  fenn  gonzales ", "KG");
});

test("trailing spaces do not become an empty last word", () => {
  // Regression guard: splitting on whitespace leaves a "" at the end, and a
  // naive last-element read would return just "K" - or crash on charAt(0).
  eq("King Gonzales   ", "KG");
  eq("King   ", "K");
});

test("tabs and newlines separate words too", () => {
  eq("King\tGonzales", "KG");
  eq("King\nGonzales", "KG");
});

// ---- empty and unusable input --------------------------------------------

test("empty string falls back", () => {
  eq("", "?");
});

test("null and undefined fall back", () => {
  eq(null, "?");
  eq(undefined, "?");
});

test("whitespace-only falls back", () => {
  eq("   ", "?");
  eq("\t\n ", "?");
});

test("the fallback is configurable", () => {
  eq("", "YOU", "YOU");
  eq(null, "YOU", "YOU");
  eq("   ", "YOU", "YOU");
});

test("a supplied fallback is ignored when the name is usable", () => {
  eq("King Gonzales", "KG", "YOU");
});

test("punctuation-only names fall back rather than showing punctuation", () => {
  eq("...", "?");
  eq("!!!", "?");
  eq("---", "?");
  eq("@#$%", "?");
});

// ---- hyphens and apostrophes ---------------------------------------------

test("a hyphenated single name gives both halves", () => {
  eq("Anne-Marie", "AM");
});

test("a hyphenated surname still yields first + last", () => {
  eq("King Gonzales-Reyes", "KR");
});

test("apostrophes stay inside the word - O'Brien is O, not OB", () => {
  eq("O'Brien", "O");
  eq("Conan O'Brien", "CO");
  eq("Shaquille O'Neal", "SO");
});

test("a curly apostrophe behaves like a straight one", () => {
  eq("O’Brien", "O");
});

test("an en dash separates like a hyphen", () => {
  eq("Anne–Marie", "AM");
});

// ---- things that must not crash ------------------------------------------

test("emoji-only names fall back instead of rendering half a surrogate pair", () => {
  eq("\u{1F389}", "?");
  eq("\u{1F389}\u{1F600}", "?");
});

test("an emoji next to a real name is skipped, not initialled", () => {
  eq("\u{1F389} King Gonzales", "KG");
  eq("King \u{1F389} Gonzales", "KG");
});

test("an emoji leading a single word does not eat that word's letter", () => {
  eq("\u{1F389}King", "K");
});

test("accented letters keep their accent", () => {
  eq("élodie Martin", "ÉM");
});

test("uppercasing never returns more than one character per word", () => {
  // "ß".toUpperCase() is "SS" - two chars from one - which would make
  // this three letters wide in a circular avatar sized for two.
  assert.strictEqual(initialsFrom("ßeta").length, 1);
  assert.strictEqual(initialsFrom("ßeta Gamma").length, 2);
});

test("digits count as an initial for handle-style names", () => {
  eq("47 Ronin", "4R");
  eq("2Pac", "2");
});

test("a very long name still yields exactly two letters", () => {
  assert.strictEqual(initialsFrom("a ".repeat(500) + "z").length, 2);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
