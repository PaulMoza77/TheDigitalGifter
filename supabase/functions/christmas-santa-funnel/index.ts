import { optionsResponse, jsonResponse, corsHeaders } from "../_shared/cors.ts";
import {
  assertAdmin,
  getAuthUser,
  getServiceClient,
  isServiceRoleRequest,
  readJson,
} from "../_shared/supabase.ts";
import { sha256Hex } from "../_shared/christmas/crypto.ts";

/**
 * Santa Video funnel: order lookup / admin retry.
 * Personalization is persisted at checkout time (service role).
 * Never starts generation without paid entitlement (retry requires service role or admin + paid).
 * Privacy: getOrder returns safe projection only (no metadata / plaintext tokens).
 */

type Body = {
  action?: string;
  public_token?: string;
  order_id?: string;
};

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

    if (action === "getOrder") {
      const token = asString(body.public_token);
      if (!token || token.length < 32) return privateJsonResponse({ error: "Invalid token" }, 400);
      const hash = await sha256Hex(token);
      const { data: order, error } = await service
        .from("christmas_orders")
        .select(
          "id,product_key,package_key,payment_status,fulfillment_status,amount_cents,currency,last_error,created_at,paid_at,result_asset_id,metadata",
        )
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!order) return privateJsonResponse({ error: "Order not found" }, 404);
      if (order.product_key !== "christmas_santa_video") {
        return privateJsonResponse({ error: "Not a Santa Video order" }, 400);
      }
      if (isDeliveryRevoked(order.metadata)) {
        return privateJsonResponse({ error: "Access revoked", code: "delivery_revoked" }, 403);
      }

      const { data: job } = await service
        .from("christmas_santa_video_jobs")
        .select(
          "id,job_status,script_status,audio_status,video_status,language,template_key,estimated_duration_seconds,error_code,error_message_safe,cost_total_usd,cost_state,latency_total_ms,result_video_path,result_video_bucket,started_at,completed_at",
        )
        .eq("order_id", order.id)
        .maybeSingle();

      // Safe personalization summary — no raw custom free-text dump by default
      const { data: perso } = await service
        .from("christmas_santa_personalization")
        .select("child_first_name,language,template_key,guardian_consent")
        .eq("order_id", order.id)
        .maybeSingle();

      let resultUrl: string | null = null;
      if (job?.result_video_bucket && job?.result_video_path && job.job_status === "completed") {
        const signed = await service.storage
          .from(job.result_video_bucket)
          .createSignedUrl(job.result_video_path, 60 * 30);
        resultUrl = signed.data?.signedUrl || null;
      } else if (order.result_asset_id) {
        const { data: asset } = await service
          .from("christmas_order_assets")
          .select("storage_bucket,storage_path")
          .eq("id", order.result_asset_id)
          .maybeSingle();
        if (asset?.storage_bucket && asset?.storage_path) {
          const signed = await service.storage
            .from(asset.storage_bucket)
            .createSignedUrl(asset.storage_path, 60 * 30);
          resultUrl = signed.data?.signedUrl || null;
        }
      }

      return privateJsonResponse({
        ok: true,
        order: {
          id: order.id,
          product_key: order.product_key,
          package_key: order.package_key,
          payment_status: order.payment_status,
          fulfillment_status: order.fulfillment_status,
          amount_cents: order.amount_cents,
          currency: order.currency,
          last_error: order.last_error,
          created_at: order.created_at,
          paid_at: order.paid_at,
          resultUrl,
          job: job
            ? {
                id: job.id,
                job_status: job.job_status,
                script_status: job.script_status,
                audio_status: job.audio_status,
                video_status: job.video_status,
                language: job.language,
                template_key: job.template_key,
                estimated_duration_seconds: job.estimated_duration_seconds,
                error_code: job.error_code,
                error_message_safe: job.error_message_safe,
                cost_total_usd: job.cost_total_usd,
                cost_state: job.cost_state,
                latency_total_ms: job.latency_total_ms,
                started_at: job.started_at,
                completed_at: job.completed_at,
                // intentionally omit result_video_path/bucket from client projection
              }
            : null,
          personalization_summary: perso
            ? {
                child_first_name: perso.child_first_name,
                language: perso.language,
                template_key: perso.template_key,
                guardian_consent: perso.guardian_consent,
              }
            : null,
        },
      });
    }

    if (action === "retryGeneration") {
      if (!isServiceRoleRequest(req)) {
        const { user } = await getAuthUser(req);
        try {
          await assertAdmin(user?.email);
        } catch {
          return jsonResponse({ error: "Forbidden" }, 403);
        }
      }
      const orderId = asString(body.order_id);
      if (!orderId) return jsonResponse({ error: "order_id required" }, 400);
      const { data: order } = await service
        .from("christmas_orders")
        .select("id,payment_status,product_key")
        .eq("id", orderId)
        .maybeSingle();
      if (!order || order.payment_status !== "paid" || order.product_key !== "christmas_santa_video") {
        return jsonResponse({ error: "payment_required" }, 402);
      }
      // Reset failed stage flags but keep successful script/audio when present
      const { data: job } = await service
        .from("christmas_santa_video_jobs")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (job) {
        const patch: Record<string, unknown> = {
          job_status: "queued",
          error_code: null,
          error_message_safe: null,
        };
        if (job.script_status === "failed") patch.script_status = "pending";
        if (job.audio_status === "failed") patch.audio_status = "pending";
        if (job.video_status === "failed") patch.video_status = "pending";
        await service.from("christmas_santa_video_jobs").update(patch).eq("order_id", orderId);
      }
      await service
        .from("christmas_orders")
        .update({ fulfillment_status: "queued", last_error: null })
        .eq("id", orderId);

      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (url && key) {
        void fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-santa-generate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ order_id: orderId, resume: true }),
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
