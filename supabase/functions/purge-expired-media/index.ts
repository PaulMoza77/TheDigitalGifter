/**
 * Scheduler for abandoned uploads / expired results.
 *
 * Dashboard schedule (hourly):
 *   cron: 15 * * * *
 *   headers: x-fulfillment-secret or Authorization: Bearer <service role>
 *
 * Deletes one storage object at a time. DB references are cleared only after
 * Storage confirms the object is gone. Storage errors leave the row eligible
 * for the next cron tick.
 */
import { jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { requireSchedulerAuth } from "../_shared/access.ts";
import { RESULT_BUCKET, UPLOAD_BUCKET } from "../_shared/uploadPath.ts";
import {
  cleanupOneRow,
  type CleanupRow,
  type StorageDeleteResult,
} from "../_shared/cleanup.ts";

const PAGE_SIZE = 50;
const MAX_PAGES = 8;

async function deleteObject(
  service: ReturnType<typeof getServiceClient>,
  bucket: string,
  path: string,
): Promise<StorageDeleteResult> {
  const { error } = await service.storage.from(bucket).remove([path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function purgeTable(
  service: ReturnType<typeof getServiceClient>,
  args: {
    listPage: () => Promise<CleanupRow[]>;
    clearReference: (id: string) => Promise<void>;
  },
): Promise<{ cleared: number; retried: number; skipped: number; pages: number }> {
  let cleared = 0;
  let retried = 0;
  let skipped = 0;
  let pages = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await args.listPage();
    if (!rows.length) break;
    pages += 1;
    for (const row of rows) {
      const action = await cleanupOneRow({
        row,
        deleteObject: (bucket, path) => deleteObject(service, bucket, path),
        clearReference: args.clearReference,
      });
      if (action === "cleared") cleared += 1;
      if (action === "retry") retried += 1;
      if (action === "skipped") skipped += 1;
    }
    if (rows.length < PAGE_SIZE) break;
  }

  return { cleared, retried, skipped, pages };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!requireSchedulerAuth(req)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  try {
    const service = getServiceClient();
    const now = new Date().toISOString();

    const abandoned = await purgeTable(service, {
      listPage: async () => {
        const { data } = await service
          .from("upload_sessions")
          .select("id, bucket, path")
          .in("status", ["pending_upload"])
          .lt("expires_at", now)
          .order("created_at", { ascending: true })
          .range(0, PAGE_SIZE - 1);
        return (data || []).map((row) => ({
          id: String(row.id),
          bucket: String(row.bucket || UPLOAD_BUCKET),
          path: row.path ? String(row.path) : null,
        }));
      },
      clearReference: async (id) => {
        await service.from("upload_sessions").update({ status: "abandoned" }).eq("id", id);
      },
    });

    const expiredUploads = await purgeTable(service, {
      listPage: async () => {
        const { data } = await service
          .from("mvp_orders")
          .select("id, photo_bucket, photo_path, upload_expires_at")
          .not("photo_path", "is", null)
          .lt("upload_expires_at", now)
          .order("upload_expires_at", { ascending: true })
          .range(0, PAGE_SIZE - 1);
        return (data || []).map((row) => ({
          id: String(row.id),
          bucket: String(row.photo_bucket || UPLOAD_BUCKET),
          path: row.photo_path ? String(row.photo_path) : null,
        }));
      },
      clearReference: async (id) => {
        await service.from("mvp_orders").update({ photo_path: null }).eq("id", id);
      },
    });

    const expiredResults = await purgeTable(service, {
      listPage: async () => {
        const { data } = await service
          .from("generations")
          .select("id, result_bucket, result_path, result_expires_at")
          .not("result_path", "is", null)
          .lt("result_expires_at", now)
          .order("result_expires_at", { ascending: true })
          .range(0, PAGE_SIZE - 1);
        return (data || []).map((row) => ({
          id: String(row.id),
          bucket: String(row.result_bucket || RESULT_BUCKET),
          path: row.result_path ? String(row.result_path) : null,
        }));
      },
      clearReference: async (id) => {
        await service
          .from("generations")
          .update({
            result_path: null,
            result_image_url: null,
            final_image_url: null,
            preview_image_url: null,
          })
          .eq("id", id);
      },
    });

    const retried = abandoned.retried + expiredUploads.retried + expiredResults.retried;
    return jsonResponse({
      page_size: PAGE_SIZE,
      pages: abandoned.pages + expiredUploads.pages + expiredResults.pages,
      purged_uploads: expiredUploads.cleared,
      purged_results: expiredResults.cleared,
      abandoned_uploads: abandoned.cleared,
      retried,
      verified: retried === 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
