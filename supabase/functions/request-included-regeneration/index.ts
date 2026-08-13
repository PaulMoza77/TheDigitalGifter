import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";

type Body = {
  order_id?: string;
  session_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const orderId = String(body.order_id || "").trim();
    const sessionId = String(body.session_id || "").trim();
    if (!orderId && !sessionId) {
      return jsonResponse({ error: "order_id or session_id is required" }, 400);
    }

    const service = getServiceClient();
    let query = service.from("mvp_orders").select("*");
    query = orderId ? query.eq("id", orderId) : query.eq("stripe_checkout_session_id", sessionId);
    const { data: order, error } = await query.maybeSingle();
    if (error) throw error;
    if (!order) return jsonResponse({ error: "Order not found" }, 404);

    if (order.status !== "completed" && order.status !== "paid" && order.status !== "fulfilling") {
      return jsonResponse({ error: "Regeneration is available after a completed purchase." }, 409);
    }

    if (Number(order.included_regenerations_used || 0) >= Number(order.included_regenerations_allowed || 0)) {
      return jsonResponse({ error: "The included regeneration has already been used." }, 409);
    }

    const { data: claimed, error: claimErr } = await service
      .from("mvp_orders")
      .update({
        included_regenerations_used: Number(order.included_regenerations_used || 0) + 1,
        status: "fulfilling",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("included_regenerations_used", order.included_regenerations_used)
      .select("id")
      .maybeSingle();

    if (claimErr) throw claimErr;
    if (!claimed) {
      return jsonResponse({ error: "Regeneration already started." }, 409);
    }

    const uploadExpires = new Date(
      Date.now() + mvpProduct.uploadRetentionHours * 60 * 60 * 1000,
    ).toISOString();
    const resultExpires = new Date(
      Date.now() + mvpProduct.resultRetentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: generation, error: genErr } = await service
      .from("generations")
      .insert({
        status: "pending",
        email: order.email,
        user_email: order.email,
        user_id: order.user_id,
        order_id: order.id,
        template_id: order.template_id,
        style_id: order.style_id,
        attempt_kind: "included_retry",
        attempt_count: 0,
        source_image_url: `${order.photo_bucket}/${order.photo_path}`,
        prompt: order.style_id || "personalized still image",
        upload_expires_at: uploadExpires,
        result_expires_at: resultExpires,
      })
      .select("id")
      .single();

    if (genErr || !generation?.id) throw new Error(genErr?.message || "Could not create regeneration");

    await service
      .from("mvp_orders")
      .update({ generation_id: generation.id, updated_at: new Date().toISOString() })
      .eq("id", order.id);

    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const secret = Deno.env.get("FULFILLMENT_SECRET") || "";
    if (!url || !anon) throw new Error("Missing SUPABASE_URL/ANON");

    const fulfillRes = await fetch(`${url}/functions/v1/fulfill-paid-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "x-fulfillment-secret": secret,
      },
      body: JSON.stringify({ order_id: order.id, generation_id: generation.id }),
    });
    const fulfillData = await fulfillRes.json().catch(() => ({}));
    if (!fulfillRes.ok) {
      return jsonResponse(
        { error: fulfillData.error || "Regeneration failed", generation_id: generation.id },
        502,
      );
    }

    return jsonResponse({
      order_id: order.id,
      generation_id: generation.id,
      status: fulfillData.status || "started",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
