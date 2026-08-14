import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";
import { authorizeOrderAccess, verifyAccessToken } from "../_shared/guestToken.ts";
import { accessTokenSecret, kickFulfillmentWorker } from "../_shared/access.ts";

type Body = {
  order_id?: string;
  access_token?: string;
  accessToken?: string;
  session_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const orderId = String(body.order_id || "").trim();
    const accessToken = String(body.access_token || body.accessToken || "").trim();
    void body.session_id;
    if (!orderId) return jsonResponse({ error: "order_id is required" }, 400);

    const { user } = await getAuthUser(req);
    const service = getServiceClient();
    const { data: order, error } = await service
      .from("mvp_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return jsonResponse({ error: "Unauthorized" }, 401);

    const token = await verifyAccessToken(accessToken, accessTokenSecret(), {
      typ: "order",
      id: String(order.id),
    });
    const allowed = authorizeOrderAccess({
      orderUserId: order.user_id ? String(order.user_id) : null,
      authUserId: user?.id ?? null,
      tokenOk: Boolean(token),
    });
    if (!allowed) return jsonResponse({ error: "Unauthorized" }, 401);

    if (order.status !== "completed" && order.status !== "paid") {
      return jsonResponse({ error: "Regeneration is available after a completed purchase." }, 409);
    }

    const uploadExpires = new Date(
      Date.now() + mvpProduct.uploadRetentionHours * 60 * 60 * 1000,
    ).toISOString();
    const resultExpires = new Date(
      Date.now() + mvpProduct.resultRetentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const prompt = String(
      order.template_prompt || "Create a personalized still image from the uploaded photo.",
    ).trim();

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
        prompt,
        upload_expires_at: uploadExpires,
        result_expires_at: resultExpires,
      })
      .select("id")
      .single();

    if (genErr || !generation?.id) throw new Error(genErr?.message || "Could not create regeneration");

    const { data: claimed, error: claimErr } = await service.rpc("claim_included_regeneration", {
      p_order_id: order.id,
      p_generation_id: generation.id,
    });
    if (claimErr) throw claimErr;

    const outcome = claimed as { kind?: string; ok?: boolean };
    if (!outcome?.ok) {
      await service.from("generations").delete().eq("id", generation.id);
      const message = outcome?.kind === "in_flight"
        ? "A regeneration is already in progress."
        : "The included regeneration has already been used.";
      return jsonResponse({ error: message }, 409);
    }

    kickFulfillmentWorker("included-regeneration");

    return jsonResponse({
      order_id: order.id,
      generation_id: generation.id,
      status: "queued",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
