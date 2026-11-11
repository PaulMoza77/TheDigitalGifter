/** Read complete, bounded datasets instead of silently accepting PostgREST's row cap. */
export async function readAdminRows<T>(
  query: () => any,
  label: string,
  maxRows = 50000,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 250;
  let expectedCount: number | null = null;
  while (true) {
    const { data, error, count } = await query().range(
      rows.length,
      rows.length + pageSize - 1,
    );
    if (error)
      throw new Error(`${label}: ${error.message || "loading failed"}`);
    if (typeof count !== "number")
      throw new Error(
        `${label}: total unavailable; incomplete results withheld`,
      );
    if (expectedCount !== null && count !== expectedCount)
      throw new Error(`${label}: data changed while loading; refresh to retry`);
    expectedCount = count;
    if (count > maxRows)
      throw new Error(
        `${label}: more than ${maxRows} records; narrow the reporting period`,
      );
    const page = (data || []) as T[];
    rows.push(...page);
    if (rows.length >= count) return rows;
    if (!page.length)
      throw new Error(`${label}: incomplete results; refresh to retry`);
  }
}
