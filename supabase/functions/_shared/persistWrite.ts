export function requirePersistedWrite(args: {
  error?: { message?: string } | null;
  rowCount?: number | null;
  label: string;
}): number {
  if (args.error) {
    throw new Error(`${args.label}: ${args.error.message || "write_failed"}`);
  }
  const count = typeof args.rowCount === "number" ? args.rowCount : 0;
  if (count < 1) {
    throw new Error(`${args.label}_no_rows`);
  }
  return count;
}

export function persistedRowCount(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") return 1;
  return 0;
}
