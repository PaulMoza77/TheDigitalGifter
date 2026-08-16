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
export type ClearReferenceResult = { ok: true } | { ok: false; error: string };

export function isAbandonedUploadCandidate(row: {
  status: string;
  consumed_order_id?: string | null;
  expires_at: string;
  now: string;
}): boolean {
  if (new Date(row.expires_at).getTime() >= new Date(row.now).getTime()) return false;
  if (row.status === "pending_upload") return true;
  if (row.status === "confirmed" && !row.consumed_order_id) return true;
  return false;
}

export function mergeCleanupSkipIds(existing: string[], failedId: string): string[] {
  if (!failedId || existing.includes(failedId)) return existing;
  return [...existing, failedId];
}

export function supabaseNotInFilter(ids: string[]): string {
  return `(${ids.join(",")})`;
}

export async function cleanupOneRow(args: {
  row: CleanupRow;
  deleteObject: (bucket: string, path: string) => Promise<StorageDeleteResult>;
  clearReference: (id: string) => Promise<ClearReferenceResult>;
}): Promise<"cleared" | "skipped" | "retry"> {
  const path = String(args.row.path || "").trim();
  if (!path) return "skipped";
  const deleted = await args.deleteObject(args.row.bucket, path);
  if (!deleted.ok) return "retry";
  try {
    const cleared = await args.clearReference(args.row.id);
    if (!cleared.ok) return "retry";
  } catch {
    return "retry";
  }
  return "cleared";
}

export async function cleanupRowsPaged<T extends CleanupRow>(args: {
  rows: T[];
  pageSize: number;
  deleteObject: (bucket: string, path: string) => Promise<StorageDeleteResult>;
  clearReference: (id: string) => Promise<ClearReferenceResult>;
}): Promise<{ cleared: number; retried: number; skipped: number; pages: number; skipIds: string[] }> {
  const pages = chunkPages(args.rows, args.pageSize);
  let cleared = 0;
  let retried = 0;
  let skipped = 0;
  let skipIds: string[] = [];
  for (const page of pages) {
    for (const row of page) {
      const action = await cleanupOneRow({
        row,
        deleteObject: args.deleteObject,
        clearReference: args.clearReference,
      });
      if (action === "cleared") cleared += 1;
      if (action === "retry") {
        retried += 1;
        skipIds = mergeCleanupSkipIds(skipIds, row.id);
      }
      if (action === "skipped") skipped += 1;
    }
  }
  return { cleared, retried, skipped, pages: pages.length, skipIds };
}
