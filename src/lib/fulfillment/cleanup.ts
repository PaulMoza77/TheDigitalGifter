export function chunkPages<T>(items: T[], pageSize: number): T[][] {
  if (pageSize <= 0) throw new Error("pageSize must be positive");
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}

export function cleanupPager(totalRows: number, pageSize: number) {
  const pages = totalRows === 0 ? 0 : Math.ceil(totalRows / pageSize);
  return {
    pages,
    pageSize,
    coversAll: pages * pageSize >= totalRows,
  };
}

export function verifyCleanupPage(args: {
  requested: number;
  deleted: number;
}): { verified: boolean; remaining: number } {
  const remaining = Math.max(0, args.requested - args.deleted);
  return { verified: remaining === 0, remaining };
}
