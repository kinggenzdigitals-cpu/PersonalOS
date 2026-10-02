/**
 * Exact, case-insensitive matching through PostgREST's `ilike` filter.
 *
 * `.ilike(column, value)` treats the value as a PATTERN: `%` and `_` are LIKE
 * wildcards, and PostgREST also rewrites every `*` to `%`. Passing a raw email
 * or username matched other people's rows — `ana_cruz@x.com` matched
 * `ana.cruz@x.com` — and on a service-role DELETE that removed another
 * invitee's invitation.
 *
 * `%`, `_` and `\` can be escaped (`\` is LIKE's default escape character), but
 * `*` cannot: PostgREST would turn `\*` into `\%`, a literal percent sign. So a
 * `*` becomes `_`, which matches any one character, and the rows that come back
 * are a superset. Always narrow them with `sameText`, which is the real test.
 */
export function ilikeExact(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&").replace(/\*/g, "_");
}

/** Case-insensitive equality — the final check on rows an `ilikeExact` filter returned. */
export function sameText(a: string | null | undefined, b: string): boolean {
  return a != null && a.toLowerCase() === b.toLowerCase();
}
