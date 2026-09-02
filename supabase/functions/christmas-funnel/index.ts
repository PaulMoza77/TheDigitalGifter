import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson, isServiceRoleRequest } from "../_shared/supabase.ts";

/**
 * Christmas photo funnel APIs: signed upload, order lookup, admin retry enqueue.
 * Pre-payment blur preview is client-side only — this function never calls Replicate.
 */

type Body = {
  action?: string;
  content_type?: string;
  byte_size?: number;
  width?: number;
  height?: number;
  style_key?: string;
  public_token?: string;
  order_id?: string;
  email?: string;
};

const SOURCE_BUCKET = "christmas-source";
const RESULT_BUCKET = "christmas-generated";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024;

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();

    if (action === "createUpload") {
      const contentType = asString(body.content_type).toLowerCase();
      const byteSize = Number(body.byte_size || 0);
      if (!ALLOWED.has(contentType)) {
        return jsonResponse({ error: "Unsupported content type", code: "invalid_photo" }, 400);
      }
      if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_BYTES) {
        return jsonResponse({ error: "Invalid file size", code: "invalid_photo" }, 400);
      }
      const uploadId = crypto.randomUUID();
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      const path = `uploads/${uploadId}.${ext}`;
      const { data, error } = await service.storage
        .from(SOURCE_BUCKET)
        .createSignedUploadUrl(path);
      if (error || !data) {
        return jsonResponse({ error: error?.message || "Could not create upload URL" }, 500);
      }
      return jsonResponse({
        ok: true,
        uploadId,
        path,
        bucket: SOURCE_BUCKET,
        token: data.token,
        signedUrl: data.signedUrl,
        // Explicit contract: upload endpoint never generates AI previews.
        replicate_preview: false,
      });
    }

    if (action === "getOrder") {
      const token = asString(body.public_token);
      if (!token || token.length < 32) {
        return jsonResponse({ error: "Invalid token" }, 400);
      }
      const hash = await sha256Hex(token);
      const { data: order, error } = await service
        .from("christmas_orders")
        .select(
          "id,product_key,package_key,style_key,payment_status,fulfillment_status,amount_cents,currency,last_error,created_at,paid_at,generation_started_at,generation_finished_at,model_name,result_asset_id",
        )
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!order) return jsonResponse({ error: "Order not found" }, 404);

      let resultUrl: string | null = null;
      if (order.result_asset_id) {
        const { data: asset } = await service
          .from("christmas_order_assets")
          .select("storage_bucket,storage_path")
          .eq("id", order.result_asset_id)
          .maybeSingle();
        if (asset?.storage_bucket && asset?.storage_path) {
          const signed = await service.storage
            .from(asset.storage_bucket)
            .createSignedUrl(asset.storage_path, 60 * 15);
          resultUrl = signed.data?.signedUrl || null;
        }
      }

      return jsonResponse({
        ok: true,
        order: {
          ...order,
          resultUrl,
        },
      });
    }

    if (action === "retryGeneration") {
      if (!isServiceRoleRequest(req)) {
        // Also allow admin JWT via service path only for now — require service role.
        return jsonResponse({ error: "Forbidden" }, 403);
      }
      const orderId = asString(body.order_id);
      if (!orderId) return jsonResponse({ error: "order_id required" }, 400);
      const { data: order } = await service
        .from("christmas_orders")
        .select("id,payment_status,fulfillment_status")
        .eq("id", orderId)
        .maybeSingle();
      if (!order || order.payment_status !== "paid") {
        return jsonResponse({ error: "payment_required" }, 402);
      }
      await service.from("christmas_generation_jobs").upsert(
        {
          order_id: orderId,
          status: "queued",
          last_error: null,
        },
        { onConflict: "order_id" },
      );
      await service
        .from("christmas_orders")
        .update({ fulfillment_status: "queued", last_error: null })
        .eq("id", orderId);

      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (url && key) {
        void fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-generate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ order_id: orderId }),
        });
      }
      return jsonResponse({ ok: true, queued: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
