/**
 * Every row a query matches, read one explicit range at a time.
 *
 * PostgREST caps an un-ranged select at the project's `max-rows` (1000 by
 * default) and returns the truncated page with NO error, so a plain select
 * silently drops everything past the first thousand rows.
 *
 * Stops at the first short page, so `pageSize` must not exceed the project's
 * `max-rows`. The caller's `page` builder MUST order by a unique column, or
 * rows can repeat or vanish between ranges.
 *
 * An error ends the walk and is handed back with the rows read so far, so the
 * caller can decide whether it is fatal.
 */
export async function fetchAllPages<T, E>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: E | null }>,
  pageSize = 1000,
): Promise<{ rows: T[]; error: E | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { rows, error };
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < pageSize) return { rows, error: null };
  }
}
