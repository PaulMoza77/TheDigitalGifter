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

export type CleanupRow = {
  id: string;
  bucket: string;
  path: string | null;
};

export type StorageDeleteResult = { ok: true; alreadyGone?: boolean } | { ok: false; error: string };

export async function cleanupOneRow(args: {
  row: CleanupRow;
  deleteObject: (bucket: string, path: string) => Promise<StorageDeleteResult>;
  clearReference: (id: string) => Promise<void>;
}): Promise<"cleared" | "skipped" | "retry"> {
  const path = String(args.row.path || "").trim();
  if (!path) return "skipped";
  const deleted = await args.deleteObject(args.row.bucket, path);
  if (!deleted.ok) return "retry";
  await args.clearReference(args.row.id);
  return "cleared";
}

export async function cleanupRowsPaged<T extends CleanupRow>(args: {
  rows: T[];
  pageSize: number;
  deleteObject: (bucket: string, path: string) => Promise<StorageDeleteResult>;
  clearReference: (id: string) => Promise<void>;
}): Promise<{ cleared: number; retried: number; skipped: number; pages: number }> {
  const pages = chunkPages(args.rows, args.pageSize);
  let cleared = 0;
  let retried = 0;
  let skipped = 0;
  for (const page of pages) {
    for (const row of page) {
      const action = await cleanupOneRow({
        row,
        deleteObject: args.deleteObject,
        clearReference: args.clearReference,
      });
      if (action === "cleared") cleared += 1;
      if (action === "retry") retried += 1;
      if (action === "skipped") skipped += 1;
    }
  }
  return { cleared, retried, skipped, pages: pages.length };
}
