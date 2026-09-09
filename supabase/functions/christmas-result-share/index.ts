import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import {
  asString,
  decryptShareToken,
  encryptShareToken,
  generatePublicToken,
  isShareToken,
  isUuid,
  publicShareUnavailable,
  publicSharedResultDto,
  sha256Hex,
  SIGNED_RESULT_TTL_SEC,
} from "../_shared/christmas/resultShare.ts";

type Body = Record<string, unknown>;

async function loadOrderByPublicToken(
  service: ReturnType<typeof getServiceClient>,
  publicToken: string,
) {
  if (!isShareToken(publicToken)) return null;
  const hash = await sha256Hex(publicToken);
  const { data: order, error } = await service
    .from("christmas_orders")
    .select(
      "id,product_key,package_key,style_key,payment_status,fulfillment_status,result_asset_id",
    )
    .eq("public_token_hash", hash)
    .maybeSingle();
  if (error) throw error;
  return order;
}

async function loadShareForOrder(
  service: ReturnType<typeof getServiceClient>,
  orderId: string,
) {
  const { data, error } = await service
    .from("christmas_generation_shares")
    .select(
      "generation_id,order_id,asset_id,share_token_hash,share_token_ciphertext,share_enabled,revoked_at,view_count",
    )
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function signAssetUrl(
  service: ReturnType<typeof getServiceClient>,
  assetId: string,
): Promise<{ resultUrl: string | null; assetKind: string | null; styleKey: string | null }> {
  const { data: asset } = await service
    .from("christmas_order_assets")
    .select("asset_kind,storage_bucket,storage_path,metadata")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset?.storage_bucket || !asset?.storage_path) {
    return { resultUrl: null, assetKind: null, styleKey: null };
  }
  const signed = await service.storage
    .from(asset.storage_bucket)
    .createSignedUrl(asset.storage_path, SIGNED_RESULT_TTL_SEC);
  const meta = (asset.metadata && typeof asset.metadata === "object"
    ? asset.metadata
    : {}) as Record<string, unknown>;
  return {
    resultUrl: signed.data?.signedUrl || null,
    assetKind: asString(asset.asset_kind) || null,
    styleKey: asString(meta.style_key) || null,
  };
}

function ownerSharePayload(
  share: {
    generation_id: string;
    share_enabled: boolean;
    share_token_ciphertext?: string | null;
  } | null,
) {
  if (!share) {
    return { ok: true, share_enabled: false, generation_id: null, share_path: null };
  }
  const token = share.share_enabled ? decryptShareToken(asString(share.share_token_ciphertext)) : "";
  return {
    ok: true,
    share_enabled: Boolean(share.share_enabled),
    generation_id: share.generation_id,
    share_token: token || null,
    share_path:
      share.share_enabled && token
        ? `/share/${share.generation_id}?token=${encodeURIComponent(token)}`
        : null,
  };
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
      const { data: share } = await service
        .from("christmas_generation_shares")
        .select("generation_id,order_id,asset_id,share_token_hash,share_enabled,view_count")
        .eq("generation_id", generationId)
        .maybeSingle();
      if (!share || !share.share_enabled || share.share_token_hash !== tokenHash) {
        return jsonResponse(publicShareUnavailable(), 404);
      }
      const { data: order } = await service
        .from("christmas_orders")
        .select("id,product_key,style_key,payment_status,fulfillment_status")
        .eq("id", share.order_id)
        .maybeSingle();
      if (!order || order.payment_status !== "paid" || order.fulfillment_status !== "completed") {
        return jsonResponse(publicShareUnavailable(), 404);
      }
      const signed = await signAssetUrl(service, share.asset_id);
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

      if (action === "getOwnerShare") {
        const share = await loadShareForOrder(service, order.id);
        return jsonResponse(ownerSharePayload(share));
      }

      if (order.payment_status !== "paid" || order.fulfillment_status !== "completed") {
        return jsonResponse({ error: "result_not_ready" }, 409);
      }
      const assetId = asString(order.result_asset_id);
      if (!assetId) return jsonResponse({ error: "result_not_ready" }, 409);

      if (action === "revokeShare") {
        const existing = await loadShareForOrder(service, order.id);
        if (!existing) {
          return jsonResponse({ ok: true, share_enabled: false, generation_id: null, share_path: null });
        }
        const rotated = generatePublicToken();
        const { error } = await service
          .from("christmas_generation_shares")
          .update({
            share_enabled: false,
            revoked_at: new Date().toISOString(),
            share_token_hash: await sha256Hex(rotated),
            share_token_ciphertext: null,
          })
          .eq("generation_id", existing.generation_id);
        if (error) throw error;
        return jsonResponse({
          ok: true,
          share_enabled: false,
          generation_id: existing.generation_id,
          share_token: null,
          share_path: null,
        });
      }

      const existing = await loadShareForOrder(service, order.id);
      if (existing?.share_enabled) {
        return jsonResponse(ownerSharePayload(existing));
      }
      const shareToken = generatePublicToken();
      const tokenHash = await sha256Hex(shareToken);
      const ciphertext = encryptShareToken(shareToken);
      if (existing) {
        const { data, error } = await service
          .from("christmas_generation_shares")
          .update({
            asset_id: assetId,
            share_enabled: true,
            revoked_at: null,
            share_token_hash: tokenHash,
            share_token_ciphertext: ciphertext,
          })
          .eq("generation_id", existing.generation_id)
          .select("generation_id,share_enabled,share_token_ciphertext")
          .single();
        if (error) throw error;
        return jsonResponse(ownerSharePayload({ ...data, share_token_ciphertext: ciphertext }));
      }
      const { data, error } = await service
        .from("christmas_generation_shares")
        .insert({
          order_id: order.id,
          asset_id: assetId,
          share_enabled: true,
          share_token_hash: tokenHash,
          share_token_ciphertext: ciphertext,
        })
        .select("generation_id,share_enabled,share_token_ciphertext")
        .single();
      if (error) throw error;
      return jsonResponse(ownerSharePayload({ ...data, share_token_ciphertext: ciphertext }));
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "share_failed";
    return jsonResponse({ error: message }, 500);
  }
});
