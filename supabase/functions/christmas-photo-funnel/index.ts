import { optionsResponse, jsonResponse, corsHeaders } from "../_shared/cors.ts";
import { getServiceClient, readJson, isServiceRoleRequest } from "../_shared/supabase.ts";
import { validatePetSpecies } from "../_shared/pet/speciesValidate.ts";
import { sha256Hex } from "../_shared/christmas/crypto.ts";

/**
 * Christmas portrait funnel APIs: signed upload, order lookup, species check, admin retry.
 * Pre-payment blur preview is client-side only — this function never calls Replicate generation.
 * Species validation may use vision (Moondream/OpenAI) — not image generation.
 * Privacy: getOrder never returns metadata / plaintext tokens; results are short-lived signed URLs.
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
  image_data_url?: string;
  expected_species?: string;
};

const SOURCE_BUCKET = "christmas-source";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024;

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function privateJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function isDeliveryRevoked(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const m = metadata as Record<string, unknown>;
  return m.delivery_revoked === true || Boolean(m.delivery_revoked_at);
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

    if (action === "validateSpecies") {
      const expectedRaw = asString(body.expected_species).toLowerCase();
      if (expectedRaw !== "dog" && expectedRaw !== "cat") {
        return jsonResponse({ error: "expected_species must be dog or cat" }, 400);
      }
      const imageDataUrl = asString(body.image_data_url);
      if (!imageDataUrl.startsWith("data:image/")) {
        return jsonResponse({ error: "image_data_url required", code: "invalid_photo" }, 400);
      }
      // Cap payload size (~2MB base64) to avoid abuse
      if (imageDataUrl.length > 2_800_000) {
        return jsonResponse({ error: "Image too large for species check", code: "invalid_photo" }, 400);
      }
      const result = await validatePetSpecies({
        imageDataUrl,
        expected: expectedRaw,
      });
      if (!result.ok) {
        const switchHint =
          expectedRaw === "dog"
            ? "This looks like a cat. Switch to Christmas Cats?"
            : "This looks like a dog. Switch to Christmas Dogs?";
        return jsonResponse(
          {
            ok: false,
            action: result.action,
            detected: result.detected,
            confidence: result.confidence,
            provider: result.provider,
            errorCode: result.errorCode,
            error: result.errorCode === "wrong_species" ? switchHint : result.error,
            switch_to: result.errorCode === "wrong_species"
              ? (expectedRaw === "dog" ? "/christmas/cats" : "/christmas/dogs")
              : null,
          },
          400,
        );
      }
      return jsonResponse({
        ok: true,
        action: result.action,
        detected: result.detected,
        confidence: result.confidence,
        provider: result.provider,
      });
    }

    if (action === "getOrder") {
      const token = asString(body.public_token);
      if (!token || token.length < 32) {
        return privateJsonResponse({ error: "Invalid token" }, 400);
      }
      const hash = await sha256Hex(token);
      const { data: order, error } = await service
        .from("christmas_orders")
        .select(
          "id,product_key,package_key,style_key,payment_status,fulfillment_status,amount_cents,currency,last_error,created_at,paid_at,generation_started_at,generation_finished_at,model_name,result_asset_id,portrait_type,species,source_route,landing_path,metadata",
        )
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!order) return privateJsonResponse({ error: "Order not found" }, 404);
      if (isDeliveryRevoked(order.metadata)) {
        return privateJsonResponse({ error: "Access revoked", code: "delivery_revoked" }, 403);
      }

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

      // Safe projection — never echo metadata (may contain legacy token hints).
      return privateJsonResponse({
        ok: true,
        order: {
          id: order.id,
          product_key: order.product_key,
          package_key: order.package_key,
          style_key: order.style_key,
          payment_status: order.payment_status,
          fulfillment_status: order.fulfillment_status,
          amount_cents: order.amount_cents,
          currency: order.currency,
          last_error: order.last_error,
          created_at: order.created_at,
          paid_at: order.paid_at,
          generation_started_at: order.generation_started_at,
          generation_finished_at: order.generation_finished_at,
          model_name: order.model_name,
          portrait_type: order.portrait_type,
          species: order.species,
          source_route: order.source_route,
          resultUrl,
        },
      });
    }

    if (action === "retryGeneration") {
      if (!isServiceRoleRequest(req)) {
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
        void fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-photo-generate`, {
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
