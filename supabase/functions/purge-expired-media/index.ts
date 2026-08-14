import { jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { requireFulfillmentSecret } from "../_shared/stripe.ts";
import { RESULT_BUCKET, UPLOAD_BUCKET } from "../_shared/uploadPath.ts";
import { verifyCleanupPage } from "../_shared/cleanup.ts";

const PAGE_SIZE = 200;

async function removeVerified(
  service: ReturnType<typeof getServiceClient>,
  bucket: string,
  paths: string[],
): Promise<{ requested: number; deleted: number; verified: boolean }> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return { requested: 0, deleted: 0, verified: true };
  const { error } = await service.storage.from(bucket).remove(unique);
  if (error) {
    console.warn(`[purge-expired-media] ${bucket}`, error.message);
    return { requested: unique.length, deleted: 0, verified: false };
  }
  const check = verifyCleanupPage({ requested: unique.length, deleted: unique.length });
  return { requested: unique.length, deleted: unique.length, verified: check.verified };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!requireFulfillmentSecret(req)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  try {
    const service = getServiceClient();
    const now = new Date().toISOString();
    let purgedUploads = 0;
    let purgedResults = 0;
    let abandonedUploads = 0;
    let pages = 0;
    let verified = true;

    while (true) {
      const { data: abandoned } = await service
        .from("upload_sessions")
        .select("id, bucket, path")
        .in("status", ["pending_upload"])
        .lt("expires_at", now)
        .order("created_at", { ascending: true })
        .range(0, PAGE_SIZE - 1);

      const abandonedRows = abandoned || [];
      if (!abandonedRows.length) break;
      pages += 1;
      const paths = abandonedRows
        .filter((row) => row.bucket === UPLOAD_BUCKET && row.path)
        .map((row) => String(row.path));
      const result = await removeVerified(service, UPLOAD_BUCKET, paths);
      verified = verified && result.verified;
      abandonedUploads += result.deleted;
      await service
        .from("upload_sessions")
        .update({ status: "abandoned" })
        .in(
          "id",
          abandonedRows.map((row) => row.id),
        );
      if (abandonedRows.length < PAGE_SIZE) break;
    }

    while (true) {
      const { data: expiredUploads } = await service
        .from("mvp_orders")
        .select("id, photo_bucket, photo_path, upload_expires_at")
        .not("photo_path", "is", null)
        .lt("upload_expires_at", now)
        .order("upload_expires_at", { ascending: true })
        .range(0, PAGE_SIZE - 1);

      const rows = expiredUploads || [];
      if (!rows.length) break;
      pages += 1;
      const uploadPaths = rows
        .filter((row) => row.photo_bucket === UPLOAD_BUCKET && row.photo_path)
        .map((row) => String(row.photo_path));
      const result = await removeVerified(service, UPLOAD_BUCKET, uploadPaths);
      verified = verified && result.verified;
      purgedUploads += result.deleted;
      if (uploadPaths.length) {
        await service
          .from("mvp_orders")
          .update({ photo_path: null })
          .in(
            "id",
            rows.map((row) => row.id),
          );
      }
      if (rows.length < PAGE_SIZE) break;
    }

    while (true) {
      const { data: expiredResults } = await service
        .from("generations")
        .select("id, result_bucket, result_path, result_expires_at")
        .not("result_path", "is", null)
        .lt("result_expires_at", now)
        .order("result_expires_at", { ascending: true })
        .range(0, PAGE_SIZE - 1);

      const rows = expiredResults || [];
      if (!rows.length) break;
      pages += 1;
      const resultPaths = rows
        .filter((row) => row.result_bucket === RESULT_BUCKET && row.result_path)
        .map((row) => String(row.result_path));
      const result = await removeVerified(service, RESULT_BUCKET, resultPaths);
      verified = verified && result.verified;
      purgedResults += result.deleted;
      if (resultPaths.length) {
        await service
          .from("generations")
          .update({
            result_path: null,
            result_image_url: null,
            final_image_url: null,
            preview_image_url: null,
          })
          .in(
            "id",
            rows.map((row) => row.id),
          );
      }
      if (rows.length < PAGE_SIZE) break;
    }

    return jsonResponse({
      page_size: PAGE_SIZE,
      pages,
      purged_uploads: purgedUploads,
      purged_results: purgedResults,
      abandoned_uploads: abandonedUploads,
      verified,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
