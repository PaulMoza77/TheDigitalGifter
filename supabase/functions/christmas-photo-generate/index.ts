import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import { kontextProInput, replicateOutputUrl } from "../_shared/pet/replicate.ts";
import {
  buildChristmasPortraitPrompt,
  recoveryRouteForOrder,
} from "../_shared/christmas/portraitPromptRegistry.ts";
import { claimAndSendChristmasLifecycle } from "../_shared/christmas/lifecycle.ts";

/**
 * Post-payment Christmas portrait generation (all verticals).
 * Refuses unpaid orders. Never used for pre-payment preview.
 * Prompts come only from the server-owned registry.
 */

type Body = { order_id?: string; prompt?: string; client_prompt?: string };

const SOURCE_BUCKET = "christmas-source";
const RESULT_BUCKET = "christmas-generated";
const DEFAULT_MODEL = "black-forest-labs/flux-kontext-pro";
/** Project tariff snapshot (same as pet Kontext). Label as estimated. */
const ESTIMATED_UNIT_COST_USD = 0.04;

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function generationMock(): boolean {
  return asString(Deno.env.get("CHRISTMAS_GENERATION_MOCK")).toLowerCase() === "true";
}

function generationEnabled(): boolean {
  const raw = asString(Deno.env.get("CHRISTMAS_GENERATION_ENABLED") || "true").toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

async function createChristmasPrediction(input: {
  prompt: string;
  imageUrl: string;
  model: string;
}): Promise<{ id: string; status?: string; output?: unknown; error?: string }> {
  const token = asString(Deno.env.get("REPLICATE_API_TOKEN"));
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");

  const createRes = await fetch(`https://api.replicate.com/v1/models/${input.model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: kontextProInput(input.prompt, input.imageUrl),
    }),
  });
  const created = await createRes.json();
  if (!createRes.ok) {
    throw new Error(String(created?.detail || created?.error || "replicate_create_failed"));
  }

  let current = created;
  let guard = 0;
  while (
    current?.status &&
    !["succeeded", "failed", "canceled"].includes(String(current.status)) &&
    guard < 60
  ) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${created.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    current = await poll.json();
    guard += 1;
  }
  return current;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!isServiceRoleRequest(req)) return jsonResponse({ error: "Forbidden" }, 403);

  try {
    const body = await readJson<Body>(req);
    // Never trust client-supplied prompts.
    void body.prompt;
    void body.client_prompt;

    const orderId = asString(body.order_id);
    if (!orderId) return jsonResponse({ error: "order_id required" }, 400);
    const service = getServiceClient();

    const { data: order, error } = await service
      .from("christmas_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return jsonResponse({ error: "order not found" }, 404);
    if (order.payment_status !== "paid") {
      return jsonResponse({ error: "payment_required", code: "payment_required" }, 402);
    }
    if (!order.source_path || !order.style_key) {
      return jsonResponse({ error: "missing_source_or_style" }, 400);
    }

    const claim = await service.rpc("claim_christmas_generation_job", { p_order_id: orderId });
    if (claim.error) throw claim.error;
    const claimData = (typeof claim.data === "string" ? JSON.parse(claim.data) : claim.data) as {
      claimed?: boolean;
      status?: string;
    };
    if (!claimData?.claimed) {
      return jsonResponse({ ok: true, status: claimData?.status || "not_claimed", claim: claimData });
    }

    if (!generationEnabled() && !generationMock()) {
      await service
        .from("christmas_generation_jobs")
        .update({ status: "held", last_error: "generation_disabled" })
        .eq("order_id", orderId);
      await service
        .from("christmas_orders")
        .update({ fulfillment_status: "failed", last_error: "generation_disabled" })
        .eq("id", orderId);
      return jsonResponse({ ok: false, code: "generation_disabled" }, 503);
    }

    const built = buildChristmasPortraitPrompt({
      productKey: asString(order.product_key),
      styleKey: asString(order.style_key),
      species: asString(order.species) || null,
      clientPrompt: body.client_prompt || body.prompt,
    });
    if (!built.ok) {
      await service
        .from("christmas_generation_jobs")
        .update({ status: "failed", last_error: built.code })
        .eq("order_id", orderId);
      await service
        .from("christmas_orders")
        .update({ fulfillment_status: "failed", last_error: built.code })
        .eq("id", orderId);
      return jsonResponse({ error: built.code, code: "invalid_style" }, 400);
    }
    const prompt = built.prompt;

    const sourceBucket = asString(order.source_bucket) || SOURCE_BUCKET;
    const { data: signed } = await service.storage
      .from(sourceBucket)
      .createSignedUrl(order.source_path, 60 * 15);
    if (!signed?.signedUrl) throw new Error("Could not sign source photo");

    const model = asString(Deno.env.get("CHRISTMAS_IMAGE_MODEL")) || DEFAULT_MODEL;
    const startedMs = Date.now();
    let predictionId = `xmas_${orderId}_${Date.now()}`;
    let resultPath = "";

    try {
      if (generationMock()) {
        predictionId = `mock_${predictionId}`;
        const { data: blob, error: dlError } = await service.storage
          .from(sourceBucket)
          .download(order.source_path);
        if (dlError || !blob) throw dlError || new Error("mock download failed");
        resultPath = `results/${orderId}.jpg`;
        const { error: upError } = await service.storage.from(RESULT_BUCKET).upload(resultPath, blob, {
          contentType: order.source_content_type || "image/jpeg",
          upsert: true,
        });
        if (upError) throw upError;
      } else {
        const prediction = await createChristmasPrediction({
          prompt,
          imageUrl: signed.signedUrl,
          model,
        });
        predictionId = asString(prediction.id) || predictionId;
        if (String(prediction.status) !== "succeeded") {
          throw new Error(asString(prediction.error) || `prediction_${prediction.status}`);
        }
        const remoteUrl = replicateOutputUrl(prediction.output);
        if (!remoteUrl) throw new Error("missing_output_url");
        const download = await fetch(remoteUrl);
        if (!download.ok) throw new Error("result_download_failed");
        const bytes = new Uint8Array(await download.arrayBuffer());
        resultPath = `results/${orderId}.jpg`;
        const { error: upError } = await service.storage.from(RESULT_BUCKET).upload(resultPath, bytes, {
          contentType: "image/jpeg",
          upsert: true,
        });
        if (upError) throw upError;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const latencyMs = Date.now() - startedMs;
      await service
        .from("christmas_generation_jobs")
        .update({
          status: "failed",
          last_error: message.slice(0, 280),
          prediction_id: predictionId,
          model_name: model,
        })
        .eq("order_id", orderId);
      await service
        .from("christmas_orders")
        .update({
          fulfillment_status: "failed",
          last_error: message.slice(0, 280),
          replicate_prediction_id: predictionId,
          model_name: model,
          metadata: {
            ...(typeof order.metadata === "object" && order.metadata ? order.metadata : {}),
            generation_latency_ms: latencyMs,
            estimated_cost_usd: ESTIMATED_UNIT_COST_USD,
            cost_state: "estimated",
            cost_notes: "Failed attempt; tariff snapshot estimate only",
            prompt_style_key: order.style_key,
            product_key: order.product_key,
          },
        })
        .eq("id", orderId);
      try {
        await claimAndSendChristmasLifecycle({
          service,
          template: "generation_failed",
          orderId,
          productKey: asString(order.product_key) || "christmas_photo",
          locale: asString(order.locale) || "en",
          email: asString(order.email) || null,
          productName: asString(order.product_key) || "Christmas portrait",
        });
      } catch {
        /* best-effort */
      }
      return jsonResponse({ ok: false, error: message, code: "generation_failed" }, 502);
    }

    const latencyMs = Date.now() - startedMs;
    const { data: asset, error: assetError } = await service
      .from("christmas_order_assets")
      .insert({
        order_id: orderId,
        asset_kind: "image",
        storage_bucket: RESULT_BUCKET,
        storage_path: resultPath,
        sort_order: 0,
        metadata: {
          style_key: order.style_key,
          product_key: order.product_key,
          portrait_type: order.portrait_type,
          species: order.species,
          mock: generationMock(),
          estimated_cost_usd: generationMock() ? 0 : ESTIMATED_UNIT_COST_USD,
          cost_state: generationMock() ? "exact" : "estimated",
        },
      })
      .select("id")
      .single();
    if (assetError) throw assetError;

    await service
      .from("christmas_generation_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        prediction_id: predictionId,
        provider: generationMock() ? "mock" : "replicate",
        model_name: model,
      })
      .eq("order_id", orderId);

    await service
      .from("christmas_orders")
      .update({
        fulfillment_status: "completed",
        generation_finished_at: new Date().toISOString(),
        result_asset_id: asset.id,
        model_name: model,
        replicate_prediction_id: predictionId,
        last_error: null,
        metadata: {
          ...(typeof order.metadata === "object" && order.metadata ? order.metadata : {}),
          generation_latency_ms: latencyMs,
          estimated_cost_usd: generationMock() ? 0 : ESTIMATED_UNIT_COST_USD,
          cost_state: generationMock() ? "exact" : "estimated",
          pricing_source: "ai_model_pricing_kontext_pro_tariff",
          prompt_style_key: order.style_key,
        },
      })
      .eq("id", orderId);

    try {
      const email = asString(order.email);
      const tokenHint = asString(
        (order.metadata as Record<string, unknown> | null)?.public_token_hint,
      );
      if (email && tokenHint) {
        const site = (
          Deno.env.get("SITE_URL") ||
          Deno.env.get("PUBLIC_APP_URL") ||
          "https://www.thedigitalgifter.com"
        ).replace(/\/$/, "");
        const route = recoveryRouteForOrder({
          productKey: asString(order.product_key),
          species: asString(order.species) || null,
          sourceRoute: asString(order.source_route) || null,
          landingPath: asString(order.landing_path) || null,
        });
        const link = `${site}${route}?token=${encodeURIComponent(tokenHint)}`;
        await claimAndSendChristmasLifecycle({
          service,
          template: "generation_ready",
          orderId,
          productKey: asString(order.product_key) || "christmas_photo",
          locale: asString(order.locale) || "en",
          email,
          productName: asString(order.product_key) || "Christmas portrait",
          resultUrl: link,
        });
      }
    } catch {
      /* best-effort transactional email */
    }

    return jsonResponse({
      ok: true,
      status: "completed",
      asset_id: asset.id,
      mock: generationMock(),
      estimated_cost_usd: generationMock() ? 0 : ESTIMATED_UNIT_COST_USD,
      cost_state: generationMock() ? "exact" : "estimated",
      latency_ms: latencyMs,
      product_key: order.product_key,
      style_key: order.style_key,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
