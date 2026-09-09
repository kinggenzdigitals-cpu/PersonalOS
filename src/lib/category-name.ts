/**
 * Category name normalisation and search.
 *
 * Pure and dependency-free so the tsc + bare-node harness can cover it, and
 * shared deliberately: the combobox decides whether to OFFER "Create …" and the
 * server action decides whether to REUSE an existing row. If those two used
 * different rules the UI would offer to create a category the server then
 * silently refused to create, which reads as a broken button.
 *
 * Migration 0023 enforces the same key at the database level with a unique
 * index on (user_id, kind, lower(btrim(name))).
 */

/** Trim the ends AND squeeze inner runs, so "Pet   Supplies" === "Pet Supplies". */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** The comparison key. Display keeps the user's own capitalisation; only matching is folded. */
export function categoryKey(name: string): string {
  return normalizeCategoryName(name).toLowerCase();
}

/** A name is usable if it survives normalisation with something left. */
export function isValidCategoryName(name: string): boolean {
  return normalizeCategoryName(name).length > 0;
}

export type NamedOption = { value: string; label: string };

/**
 * Case-insensitive search, prefix matches first.
 *
 * Ordering matters more than it looks: typing "a" should surface "Auto" ahead
 * of "Meta", because a user typing one letter is starting a word, not hunting
 * for a substring.
 */
export function filterByName<T extends NamedOption>(
  options: T[],
  query: string,
): T[] {
  const q = categoryKey(query);
  if (!q) return options;
  const starts: T[] = [];
  const contains: T[] = [];
  for (const o of options) {
    const key = categoryKey(o.label);
    if (key.startsWith(q)) starts.push(o);
    else if (key.includes(q)) contains.push(o);
  }
  return [...starts, ...contains];
}

/** True when the query already names an option exactly (after normalisation). */
export function hasExactName(options: NamedOption[], query: string): boolean {
  const q = categoryKey(query);
  if (!q) return false;
  return options.some((o) => categoryKey(o.label) === q);
}

/**
 * Whether to offer "Create …".
 *
 * Withheld on an exact match so "food" against an existing "Food" offers the
 * existing row instead of a duplicate — the single most important case here.
 */
export function canOfferCreate(
  options: NamedOption[],
  query: string,
): boolean {
  return isValidCategoryName(query) && !hasExactName(options, query);
}
