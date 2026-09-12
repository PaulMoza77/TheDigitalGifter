import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import {
  asString,
  generatePublicToken,
  isShareToken,
  isUuid,
  publicShareUnavailable,
  publicSharedResultDto,
  sha256Hex,
  SIGNED_RESULT_TTL_SEC,
} from "../_shared/christmas/resultShare.ts";

type Body = Record<string, unknown>;

type Service = ReturnType<typeof getServiceClient>;

async function loadOrderByPublicToken(service: Service, publicToken: string) {
  if (!isShareToken(publicToken)) return null;
  const hash = await sha256Hex(publicToken);
  const { data: order, error } = await service
    .from("christmas_orders")
    .select("id,product_key,package_key,style_key,payment_status,fulfillment_status,result_asset_id")
    .eq("public_token_hash", hash)
    .maybeSingle();
  if (error) throw error;
  return order;
}

async function loadShareForOrder(service: Service, orderId: string) {
  const { data, error } = await service
    .from("christmas_generation_shares")
    .select("generation_id,order_id,asset_id,share_token_hash,share_enabled,revoked_at,view_count")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function signAssetUrl(service: Service, assetId: string, orderId: string) {
  const { data: asset, error } = await service
    .from("christmas_order_assets")
    .select("asset_kind,storage_bucket,storage_path,metadata,order_id")
    .eq("id", assetId)
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!asset || asset.storage_bucket !== "christmas-generated" || !asset.storage_path) {
    return { resultUrl: null, assetKind: null, styleKey: null };
  }
  const signed = await service.storage
    .from("christmas-generated")
    .createSignedUrl(asset.storage_path, SIGNED_RESULT_TTL_SEC);
  const meta = (asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {}) as Record<string, unknown>;
  return {
    resultUrl: signed.data?.signedUrl || null,
    assetKind: asString(asset.asset_kind) || null,
    styleKey: asString(meta.style_key) || null,
  };
}

function ownerShareStatus(share: { generation_id: string; share_enabled: boolean } | null) {
  return {
    ok: true,
    share_enabled: Boolean(share?.share_enabled),
    generation_id: share?.generation_id || null,
    share_token: null,
    share_path: null,
  } as const;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();

    if (action === "getSharedResult") {
      const generationId = asString(body.generation_id);
      const token = asString(body.token);
      if (!isUuid(generationId) || !isShareToken(token)) {
        return jsonResponse(publicShareUnavailable(), 404);
      }
      const tokenHash = await sha256Hex(token);
      const { data: share, error: shareError } = await service
        .from("christmas_generation_shares")
        .select("generation_id,order_id,asset_id,share_token_hash,share_enabled,view_count")
        .eq("generation_id", generationId)
        .maybeSingle();
      if (shareError) throw shareError;
      if (!share || !share.share_enabled || share.share_token_hash !== tokenHash) {
        return jsonResponse(publicShareUnavailable(), 404);
      }

      const { data: order, error: orderError } = await service
        .from("christmas_orders")
        .select("id,product_key,style_key,payment_status,fulfillment_status,result_asset_id")
        .eq("id", share.order_id)
        .maybeSingle();
      if (orderError) throw orderError;
      if (
        !order ||
        order.payment_status !== "paid" ||
        order.fulfillment_status !== "completed" ||
        asString(order.result_asset_id) !== asString(share.asset_id)
      ) {
        return jsonResponse(publicShareUnavailable(), 404);
      }

      const signed = await signAssetUrl(service, share.asset_id, share.order_id);
      if (!signed.resultUrl) return jsonResponse(publicShareUnavailable(), 404);

      await service
        .from("christmas_generation_shares")
        .update({
          view_count: Number(share.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq("generation_id", share.generation_id);

      return jsonResponse({
        ok: true,
        ...publicSharedResultDto({
          generationId: share.generation_id,
          productKey: asString(order.product_key) || null,
          assetKind: signed.assetKind,
          styleKey: asString(order.style_key) || signed.styleKey,
          resultUrl: signed.resultUrl,
        }),
      });
    }

    if (action === "getOwnerShare" || action === "enableShare" || action === "revokeShare") {
      const order = await loadOrderByPublicToken(service, asString(body.public_token));
      if (!order) return jsonResponse({ error: "not_found" }, 404);

      const existing = await loadShareForOrder(service, order.id);
      if (action === "getOwnerShare") {
        return jsonResponse(ownerShareStatus(existing));
      }

      if (order.payment_status !== "paid" || order.fulfillment_status !== "completed") {
        return jsonResponse({ error: "result_not_ready" }, 409);
      }
      const assetId = asString(order.result_asset_id);
      if (!assetId) return jsonResponse({ error: "result_not_ready" }, 409);

      if (action === "revokeShare") {
        if (!existing) return jsonResponse(ownerShareStatus(null));
        const rotated = generatePublicToken();
        const { error } = await service
          .from("christmas_generation_shares")
          .update({
            share_enabled: false,
            revoked_at: new Date().toISOString(),
            share_token_hash: await sha256Hex(rotated),
          })
          .eq("generation_id", existing.generation_id)
          .eq("order_id", order.id);
        if (error) throw error;
        return jsonResponse({
          ok: true,
          share_enabled: false,
          generation_id: existing.generation_id,
          share_token: null,
          share_path: null,
        });
      }

      // Never store a recoverable share token. Enabling (or re-enabling) rotates
      // the capability and returns the plaintext exactly once to the owner client.
      const shareToken = generatePublicToken();
      const tokenHash = await sha256Hex(shareToken);
      let generationId: string;
      if (existing) {
        const { data, error } = await service
          .from("christmas_generation_shares")
          .update({
            asset_id: assetId,
            share_enabled: true,
            revoked_at: null,
            share_token_hash: tokenHash,
          })
          .eq("generation_id", existing.generation_id)
          .eq("order_id", order.id)
          .select("generation_id")
          .single();
        if (error) throw error;
        generationId = data.generation_id;
      } else {
        const { data, error } = await service
          .from("christmas_generation_shares")
          .insert({
            order_id: order.id,
            asset_id: assetId,
            share_enabled: true,
            share_token_hash: tokenHash,
          })
          .select("generation_id")
          .single();
        if (error) throw error;
        generationId = data.generation_id;
      }

      return jsonResponse({
        ok: true,
        share_enabled: true,
        generation_id: generationId,
        share_token: shareToken,
        share_path: `/share/${generationId}?token=${encodeURIComponent(shareToken)}`,
      });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error(JSON.stringify({
      source: "christmas-result-share",
      message: error instanceof Error ? error.message : "share_failed",
    }));
    return jsonResponse({ error: "share_failed" }, 500);
  }
});
