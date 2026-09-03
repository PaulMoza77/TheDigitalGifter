import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import {
  assertAdmin,
  getAuthUser,
  getServiceClient,
  isServiceRoleRequest,
  readJson,
} from "../_shared/supabase.ts";

/**
 * Santa Video funnel: order lookup / admin retry.
 * Personalization is persisted at checkout time (service role).
 * Never starts generation without paid entitlement (retry requires service role or admin + paid).
 */

type Body = {
  action?: string;
  public_token?: string;
  order_id?: string;
};

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

    if (action === "getOrder") {
      const token = asString(body.public_token);
      if (!token || token.length < 32) return jsonResponse({ error: "Invalid token" }, 400);
      const hash = await sha256Hex(token);
      const { data: order, error } = await service
        .from("christmas_orders")
        .select(
          "id,product_key,package_key,payment_status,fulfillment_status,amount_cents,currency,last_error,created_at,paid_at,result_asset_id,metadata",
        )
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!order) return jsonResponse({ error: "Order not found" }, 404);
      if (order.product_key !== "christmas_santa_video") {
        return jsonResponse({ error: "Not a Santa Video order" }, 400);
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

      return jsonResponse({
        ok: true,
        order: {
          ...order,
          resultUrl,
          job,
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
