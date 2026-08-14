import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";
import { signAccessToken } from "../_shared/guestToken.ts";
import { accessTokenSecret, sha256Hex } from "../_shared/access.ts";

type Body = {
  order_id?: string;
  orderId?: string;
  code?: string;
  rc?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const orderId = String(body.order_id || body.orderId || "").trim();
    const code = String(body.code || body.rc || "").trim();
    if (!orderId || !code) {
      return jsonResponse({ error: "order_id and code are required" }, 400);
    }

    const secret = accessTokenSecret();
    const service = getServiceClient();
    const { data, error } = await service.rpc("consume_access_redeem_code", {
      p_code_hash: await sha256Hex(code),
    });
    if (error) throw error;
    if (!data?.ok || String(data.order_id || "") !== orderId) {
      return jsonResponse({ error: "Invalid or expired code" }, 401);
    }

    const accessToken = await signAccessToken(
      {
        typ: "order",
        id: orderId,
        exp: Math.floor(Date.now() / 1000) + mvpProduct.resultRetentionDays * 24 * 3600,
      },
      secret,
    );

    return jsonResponse({ order_id: orderId, access_token: accessToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
