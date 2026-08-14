/**
 * Abandoned uploads / expired results.
 *
 * Official installer: supabase/migrations/20260817_fulfillment_schedules.sql
 * and docs/fulfillment-schedules.md. config.toml comments are not a scheduler.
 *
 * Deletes one storage object at a time. DB references are cleared only after
 * Storage confirms the object is gone. A failed DB update is never counted as
 * cleared. Failed row ids are skipped inside this invocation so pagination
 * can advance.
 */
import { jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { requireSchedulerAuth } from "../_shared/access.ts";
import { RESULT_BUCKET, UPLOAD_BUCKET } from "../_shared/uploadPath.ts";
import {
  cleanupOneRow,
  supabaseNotInFilter,
  type CleanupRow,
  type ClearReferenceResult,
  type StorageDeleteResult,
} from "../_shared/cleanup.ts";

const PAGE_SIZE = 50;
const MAX_PAGES = 8;

type ServiceClient = ReturnType<typeof getServiceClient>;

async function deleteObject(
  service: ServiceClient,
  bucket: string,
  path: string,
): Promise<StorageDeleteResult> {
  const { error } = await service.storage.from(bucket).remove([path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function purgeTable(
  service: ServiceClient,
  args: {
    listPage: (skipIds: string[]) => Promise<CleanupRow[]>;
    clearReference: (id: string) => Promise<ClearReferenceResult>;
  },
): Promise<{ cleared: number; retried: number; skipped: number; pages: number }> {
  let cleared = 0;
  let retried = 0;
  let skipped = 0;
  let pages = 0;
  const skipIds: string[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await args.listPage(skipIds);
    if (!rows.length) break;
    pages += 1;
    for (const row of rows) {
      const action = await cleanupOneRow({
        row,
        deleteObject: (bucket, path) => deleteObject(service, bucket, path),
        clearReference: args.clearReference,
      });
      if (action === "cleared") cleared += 1;
      if (action === "retry") {
        retried += 1;
        skipIds.push(row.id);
      }
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
      listPage: async (skipIds) => {
        let query = service
          .from("upload_sessions")
          .select("id, bucket, path, status, consumed_order_id")
          .in("status", ["pending_upload", "confirmed"])
          .is("consumed_order_id", null)
          .lt("expires_at", now)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(0, PAGE_SIZE - 1);
        const skipped = skipIds.length
          ? query.not("id", "in", supabaseNotInFilter(skipIds))
          : query;
        const { data, error } = await skipped;
        if (error) throw new Error(`upload_sessions select failed: ${error.message}`);
        return (data || []).map((row) => ({
          id: String(row.id),
          bucket: String(row.bucket || UPLOAD_BUCKET),
          path: row.path ? String(row.path) : null,
        }));
      },
      clearReference: async (id) => {
        const { error } = await service.from("upload_sessions").update({ status: "abandoned" }).eq("id", id);
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      },
    });

    const expiredUploads = await purgeTable(service, {
      listPage: async (skipIds) => {
        let query = service
          .from("mvp_orders")
          .select("id, photo_bucket, photo_path, upload_expires_at")
          .not("photo_path", "is", null)
          .lt("upload_expires_at", now)
          .order("upload_expires_at", { ascending: true })
          .order("id", { ascending: true })
          .range(0, PAGE_SIZE - 1);
        const skipped = skipIds.length
          ? query.not("id", "in", supabaseNotInFilter(skipIds))
          : query;
        const { data, error } = await skipped;
        if (error) throw new Error(`mvp_orders select failed: ${error.message}`);
        return (data || []).map((row) => ({
          id: String(row.id),
          bucket: String(row.photo_bucket || UPLOAD_BUCKET),
          path: row.photo_path ? String(row.photo_path) : null,
        }));
      },
      clearReference: async (id) => {
        const { error } = await service.from("mvp_orders").update({ photo_path: null }).eq("id", id);
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      },
    });

    const expiredResults = await purgeTable(service, {
      listPage: async (skipIds) => {
        let query = service
          .from("generations")
          .select("id, result_bucket, result_path, result_expires_at")
          .not("result_path", "is", null)
          .lt("result_expires_at", now)
          .order("result_expires_at", { ascending: true })
          .order("id", { ascending: true })
          .range(0, PAGE_SIZE - 1);
        const skipped = skipIds.length
          ? query.not("id", "in", supabaseNotInFilter(skipIds))
          : query;
        const { data, error } = await skipped;
        if (error) throw new Error(`generations select failed: ${error.message}`);
        return (data || []).map((row) => ({
          id: String(row.id),
          bucket: String(row.result_bucket || RESULT_BUCKET),
          path: row.result_path ? String(row.result_path) : null,
        }));
      },
      clearReference: async (id) => {
        const { error } = await service
          .from("generations")
          .update({
            result_path: null,
            result_image_url: null,
            final_image_url: null,
            preview_image_url: null,
          })
          .eq("id", id);
        if (error) return { ok: false, error: error.message };
        return { ok: true };
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
