// Runs against the tsc output in .tmp-test (see package.json "test:category-name").
const assert = require("node:assert/strict");
const {
  normalizeCategoryName,
  categoryKey,
  isValidCategoryName,
  filterByName,
  hasExactName,
  canOfferCreate,
} = require("../.tmp-test/category-name.js");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}\n  ${err.message}`);
  }
}

const opts = [
  { value: "1", label: "Auto" },
  { value: "2", label: "Allowance" },
  { value: "3", label: "Appliances" },
  { value: "4", label: "Transportation" },
  { value: "5", label: "Food" },
  { value: "6", label: "Meta Ads" },
];
const labels = (xs) => xs.map((o) => o.label);

// ---- normalisation ---------------------------------------------------------
test("trims the ends", () =>
  assert.equal(normalizeCategoryName("  Food  "), "Food"));
test("squeezes inner whitespace runs", () =>
  assert.equal(normalizeCategoryName("Pet   Supplies"), "Pet Supplies"));
test("squeezes tabs and newlines too", () =>
  assert.equal(normalizeCategoryName("Pet\t\nSupplies"), "Pet Supplies"));
test("keeps the user's capitalisation for display", () =>
  assert.equal(normalizeCategoryName("Pet Supplies"), "Pet Supplies"));
test("key folds case", () => assert.equal(categoryKey("  FOOD "), "food"));
test("Food / food / ' FOOD ' share one key", () => {
  const k = categoryKey("Food");
  assert.equal(categoryKey("food"), k);
  assert.equal(categoryKey(" FOOD "), k);
  assert.equal(categoryKey("  food  "), k);
});

// ---- validity --------------------------------------------------------------
test("blank is invalid", () => assert.equal(isValidCategoryName(""), false));
test("spaces-only is invalid", () =>
  assert.equal(isValidCategoryName("     "), false));
test("tabs/newlines-only is invalid", () =>
  assert.equal(isValidCategoryName("\t\n "), false));
test("a real name is valid", () =>
  assert.equal(isValidCategoryName("Pet Supplies"), true));
test("a single character is valid (no invented length limit)", () =>
  assert.equal(isValidCategoryName("A"), true));

// ---- search ----------------------------------------------------------------
test("empty query returns everything, in order", () =>
  assert.deepEqual(labels(filterByName(opts, "")), labels(opts)));
test("whitespace-only query returns everything", () =>
  assert.deepEqual(labels(filterByName(opts, "   ")), labels(opts)));
test("one letter filters to matches", () =>
  assert.deepEqual(labels(filterByName(opts, "A")), [
    "Auto",
    "Allowance",
    "Appliances",
    // Substring matches follow, in input order: Transportation (index 3)
    // sits before Meta Ads (index 5).
    "Transportation",
    "Meta Ads",
  ]));
test("prefix matches come before substring matches", () => {
  const r = labels(filterByName(opts, "a"));
  assert.ok(r.indexOf("Auto") < r.indexOf("Meta Ads"));
  assert.ok(r.indexOf("Appliances") < r.indexOf("Transportation"));
});
test("narrows as the query grows", () =>
  assert.deepEqual(labels(filterByName(opts, "Auto")), ["Auto"]));
test("partial substring matches ('trans' -> Transportation)", () =>
  assert.deepEqual(labels(filterByName(opts, "trans")), ["Transportation"]));
test("search is case-insensitive", () => {
  assert.deepEqual(labels(filterByName(opts, "FOOD")), ["Food"]);
  assert.deepEqual(labels(filterByName(opts, "fOoD")), ["Food"]);
});
test("search ignores padding", () =>
  assert.deepEqual(labels(filterByName(opts, "  food  ")), ["Food"]));
test("no match yields an empty list", () =>
  assert.deepEqual(filterByName(opts, "zzz"), []));
test("does not mutate the input array", () => {
  const before = labels(opts);
  filterByName(opts, "a");
  assert.deepEqual(labels(opts), before);
});

// ---- exact match + create affordance --------------------------------------
test("exact match is detected case-insensitively", () => {
  assert.equal(hasExactName(opts, "food"), true);
  assert.equal(hasExactName(opts, " FOOD "), true);
});
test("a prefix is not an exact match", () =>
  assert.equal(hasExactName(opts, "Foo"), false));
test("empty query is never an exact match", () =>
  assert.equal(hasExactName(opts, ""), false));

test("offers Create for a genuinely new name", () =>
  assert.equal(canOfferCreate(opts, "Pet Supplies"), true));
test("does NOT offer Create when the name exists (any case)", () => {
  assert.equal(canOfferCreate(opts, "Food"), false);
  assert.equal(canOfferCreate(opts, "food"), false);
  assert.equal(canOfferCreate(opts, "  FOOD  "), false);
});
test("does NOT offer Create for blank input", () => {
  assert.equal(canOfferCreate(opts, ""), false);
  assert.equal(canOfferCreate(opts, "    "), false);
});
test("offers Create for a partial that matches nothing exactly", () =>
  // "Auto Maintenance" contains "Auto" but is not the same category.
  assert.equal(canOfferCreate(opts, "Auto Maintenance"), true));
test("inner-space variants of an existing name do not create a duplicate", () => {
  const withSpaced = [...opts, { value: "7", label: "Pet Supplies" }];
  assert.equal(canOfferCreate(withSpaced, "Pet   Supplies"), false);
  assert.equal(canOfferCreate(withSpaced, "pet supplies"), false);
});

console.log(`category-name: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
