import { jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

async function purgeBucketPrefix(
  service: ReturnType<typeof getServiceClient>,
  bucket: string,
  paths: string[],
) {
  if (!paths.length) return;
  const { error } = await service.storage.from(bucket).remove(paths);
  if (error) console.warn(`[purge-expired-media] ${bucket}`, error.message);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("FULFILLMENT_SECRET") || "";
  const provided = req.headers.get("x-fulfillment-secret") || "";
  if (!secret || provided !== secret) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  try {
    const service = getServiceClient();
    const now = new Date().toISOString();

    const { data: expiredUploads } = await service
      .from("mvp_orders")
      .select("id, photo_bucket, photo_path, upload_expires_at")
      .not("photo_path", "is", null)
      .lt("upload_expires_at", now)
      .limit(200);

    const uploadPaths = (expiredUploads || [])
      .filter((row) => row.photo_bucket === "customer-uploads" && row.photo_path)
      .map((row) => String(row.photo_path));
    await purgeBucketPrefix(service, "customer-uploads", uploadPaths);

    const { data: expiredResults } = await service
      .from("generations")
      .select("id, result_bucket, result_path, result_expires_at")
      .not("result_path", "is", null)
      .lt("result_expires_at", now)
      .limit(200);

    const resultPaths = (expiredResults || [])
      .filter((row) => row.result_bucket === "generated-results" && row.result_path)
      .map((row) => String(row.result_path));
    await purgeBucketPrefix(service, "generated-results", resultPaths);

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
          (expiredResults || []).map((row) => row.id),
        );
    }

    return jsonResponse({
      purged_uploads: uploadPaths.length,
      purged_results: resultPaths.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
