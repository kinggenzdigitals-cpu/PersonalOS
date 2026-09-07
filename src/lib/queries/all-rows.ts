/** Supabase caps individual responses. Never silently calculate from a partial set. */
export async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null; count?: number | null }>,
  errorMessage = "Budget data could not be loaded. Please try again.",
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ;) {
    const result = await page(from, from + 499);
    if (result.error) throw new Error(errorMessage);
    const next = result.data ?? [];
    rows.push(...next);
    if (typeof result.count === "number") {
      if (rows.length >= result.count) return rows;
      if (next.length === 0) throw new Error(errorMessage);
    } else if (next.length < 500) {
      return rows;
    }
    from += next.length;
  }
}
