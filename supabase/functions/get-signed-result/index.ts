import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";

type Body = {
  session_id?: string;
  order_id?: string;
  generation_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const sessionId = String(body.session_id || "").trim();
    const orderId = String(body.order_id || "").trim();
    const generationId = String(body.generation_id || "").trim();

    if (!sessionId && !orderId && !generationId) {
      return jsonResponse({ error: "session_id, order_id, or generation_id is required" }, 400);
    }

    const service = getServiceClient();
    let orderQuery = service.from("mvp_orders").select("*");
    if (orderId) orderQuery = orderQuery.eq("id", orderId);
    else if (sessionId) orderQuery = orderQuery.eq("stripe_checkout_session_id", sessionId);
    else orderQuery = orderQuery.eq("generation_id", generationId);

    const { data: order, error: orderErr } = await orderQuery.maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) {
      return jsonResponse({
        status: "waiting",
        message: "Waiting for payment confirmation.",
      });
    }

    const genId = String(order.generation_id || generationId || "");
    const { data: generation } = genId
      ? await service.from("generations").select("*").eq("id", genId).maybeSingle()
      : { data: null };

    let signedUrl: string | null = null;
    const bucket = String(generation?.result_bucket || "");
    const path = String(generation?.result_path || "");
    if (bucket && path && String(generation?.status || "") === "completed") {
      const signed = await service.storage
        .from(bucket)
        .createSignedUrl(path, mvpProduct.signedUrlTtlSeconds);
      signedUrl = signed.data?.signedUrl || null;
    }

    return jsonResponse({
      order_id: order.id,
      generation_id: genId || null,
      order_status: order.status,
      generation_status: generation?.status || "pending",
      error: generation?.error || order.error || null,
      image_url: signedUrl,
      regenerations_used: order.included_regenerations_used,
      regenerations_allowed: order.included_regenerations_allowed,
      ai_generated: true,
      license: order.license,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
