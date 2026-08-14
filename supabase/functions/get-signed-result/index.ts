import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";
import { authorizeOrderAccess, verifyAccessToken } from "../_shared/guestToken.ts";
import { accessTokenSecret } from "../_shared/access.ts";
import { RESULT_BUCKET } from "../_shared/uploadPath.ts";

type Body = {
  order_id?: string;
  generation_id?: string;
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
    const generationId = String(body.generation_id || "").trim();
    const accessToken = String(body.access_token || body.accessToken || "").trim();
    void body.session_id;

    if (!orderId && !generationId) {
      return jsonResponse({ error: "order_id or generation_id is required" }, 400);
    }

    const { user } = await getAuthUser(req);
    const service = getServiceClient();

    let orderQuery = service.from("mvp_orders").select("*");
    if (orderId) orderQuery = orderQuery.eq("id", orderId);
    else orderQuery = orderQuery.eq("generation_id", generationId);

    const { data: order, error: orderErr } = await orderQuery.maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = await verifyAccessToken(accessToken, accessTokenSecret(), {
      typ: "order",
      id: String(order.id),
    });
    const allowed = authorizeOrderAccess({
      orderUserId: order.user_id ? String(order.user_id) : null,
      authUserId: user?.id ?? null,
      tokenOk: Boolean(token),
    });
    if (!allowed) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const genId = String(order.generation_id || generationId || "");
    const { data: generation } = genId
      ? await service.from("generations").select("*").eq("id", genId).maybeSingle()
      : { data: null };

    let signedUrl: string | null = null;
    const bucket = String(generation?.result_bucket || RESULT_BUCKET);
    const path = String(generation?.result_path || "");
    if (path && String(generation?.status || "") === "completed") {
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
