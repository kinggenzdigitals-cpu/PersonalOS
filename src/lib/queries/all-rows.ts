/** Supabase caps individual responses. Never silently calculate from a partial set. */
export async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await page(from, from + 499);
    if (result.error) throw new Error("Budget data could not be loaded. Please try again.");
    const next = result.data ?? [];
    rows.push(...next);
    if (next.length < 500) return rows;
  }
}
