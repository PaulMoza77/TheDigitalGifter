import { jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import { requireFulfillmentSecret } from "../_shared/stripe.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";
import { signAccessToken } from "../_shared/guestToken.ts";
import { accessTokenSecret } from "../_shared/access.ts";
import { RESULT_BUCKET, resultObjectPath, UPLOAD_BUCKET } from "../_shared/uploadPath.ts";
import { configuredAppOrigin, resultEmailHref } from "../_shared/appOrigin.ts";
import {
  detectStillImageMime,
  isStillImageTemplate,
  reuseExistingPredictionId,
  shouldCreateNewPrediction,
  TEMPLATE_ACTIVE_COLUMN,
} from "../_shared/generationRecovery.ts";
import { shouldStampResultEmailedAt, type ResultEmailSendResult } from "../_shared/stripePayment.ts";
import { persistedRowCount, requirePersistedWrite } from "../_shared/persistWrite.ts";

const TERMINAL_ORDER_STATUSES = new Set(["refunded", "canceled"]);

function isTerminalOrderStatus(status: unknown): boolean {
  return TERMINAL_ORDER_STATUSES.has(String(status || ""));
}

type Body = {
  order_id?: string;
  orderId?: string;
  generation_id?: string;
  generationId?: string;
  job_id?: string;
  email_only?: boolean;
};

type ReplicatePrediction = {
  id?: string;
  status?: string;
  error?: string | null;
  detail?: string;
  output?: unknown;
};

const REPLICATE_POLL_MS = 2000;
const REPLICATE_MAX_POLLS = 45;

async function signedDownloadUrl(
  service: ReturnType<typeof getServiceClient>,
  bucket: string,
  path: string,
) {
  const { data, error } = await service.storage
    .from(bucket)
    .createSignedUrl(path, mvpProduct.signedUrlTtlSeconds);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Could not sign upload");
  return data.signedUrl;
}

async function sendResultEmail(args: {
  email: string;
  orderId: string;
  accessToken: string;
}): Promise<ResultEmailSendResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("[fulfill-paid-order] RESEND_API_KEY missing; email required at launch, retrying later");
    return { ok: false as const, skipped: true, error: "resend_missing" };
  }

  const from = Deno.env.get("RESULT_EMAIL_FROM") || "TheDigitalGifter <support@thedigitalgifter.com>";
  let resultHref: string;
  try {
    resultHref = resultEmailHref(
      configuredAppOrigin(Deno.env.get("SITE_URL")),
      args.orderId,
      args.accessToken,
    );
  } catch (err) {
    console.warn("[fulfill-paid-order] SITE_URL missing; email retry later", err);
    return { ok: false as const, skipped: true, error: "site_url_missing" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.email],
      subject: "Your TheDigitalGifter image is ready",
      html: `<p>Your personalized still image is ready.</p>
<p><a href="${resultHref}">Open your result</a></p>
<p>This image is AI-generated. Personal use only. Results are kept for 30 days.</p>`,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn("[fulfill-paid-order] email failed:", text);
    return { ok: false as const, skipped: false, error: text };
  }
  return { ok: true as const };
}

function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && output.startsWith("http")) return output;
  if (Array.isArray(output)) {
    const first = output.find((item) => typeof item === "string" && item.startsWith("http"));
    return typeof first === "string" ? first : null;
  }
  if (output && typeof output === "object" && "url" in output) {
    const url = (output as { url?: unknown }).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

function replicateHeaders(token: string, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

async function getPrediction(token: string, id: string): Promise<ReplicatePrediction> {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: replicateHeaders(token),
  });
  const body = (await res.json()) as ReplicatePrediction;
  if (!res.ok) throw new Error(body.detail || body.error || `Replicate GET ${res.status}`);
  return body;
}

async function pollPrediction(token: string, id: string): Promise<ReplicatePrediction> {
  for (let i = 0; i < REPLICATE_MAX_POLLS; i += 1) {
    const prediction = await getPrediction(token, id);
    if (["succeeded", "failed", "canceled"].includes(String(prediction.status || ""))) {
      return prediction;
    }
    await new Promise((r) => setTimeout(r, REPLICATE_POLL_MS));
  }
  throw new Error("replicate_poll_timeout");
}

async function createPrediction(
  token: string,
  prompt: string,
  imageUrl: string | null,
): Promise<ReplicatePrediction> {
  const model =
    Deno.env.get("REPLICATE_NANO_BANANA_MODEL") ||
    Deno.env.get("REPLICATE_IMAGE_MODEL") ||
    "google/nano-banana";

  const input: Record<string, unknown> = { prompt };
  if (imageUrl) {
    input.image = imageUrl;
    input.image_input = [imageUrl];
  }

  const createRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: replicateHeaders(token),
    body: JSON.stringify({ input }),
  });
  let prediction = (await createRes.json()) as ReplicatePrediction;
  if (createRes.ok && prediction.id) return prediction;

  const version = Deno.env.get("REPLICATE_MODEL_VERSION");
  if (!version) {
    throw new Error(prediction.detail || prediction.error || "Replicate prediction failed");
  }
  const res2 = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: replicateHeaders(token),
    body: JSON.stringify({ version, input }),
  });
  prediction = (await res2.json()) as ReplicatePrediction;
  if (!res2.ok || !prediction.id) {
    throw new Error(prediction.detail || prediction.error || "Replicate prediction failed");
  }
  return prediction;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!requireFulfillmentSecret(req)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const service = getServiceClient();
  let generationId = "";
  let claimedRun = false;

  const release = async (reason: string) => {
    if (!claimedRun || !generationId) return;
    claimedRun = false;
    const { error } = await service.rpc("release_mvp_generation_claim", {
      p_generation_id: generationId,
      p_error: reason,
    });
    if (error) throw new Error(`release_mvp_generation_claim: ${error.message}`);
  };

  try {
    const body = await readJson<Body>(req);
    const orderId = String(body.order_id || body.orderId || "").trim();
    generationId = String(body.generation_id || body.generationId || "").trim();
    if (!orderId || !generationId) {
      return jsonResponse({ error: "order_id and generation_id are required", ok: false }, 400);
    }

    if (body.email_only === true) {
      const { data: order, error: orderErr } = await service
        .from("mvp_orders")
        .select("id, email, result_emailed_at, status")
        .eq("id", orderId)
        .maybeSingle();
      if (orderErr) throw orderErr;
      if (!order) return jsonResponse({ error: "order not found", ok: false, email_ok: false }, 404);
      if (isTerminalOrderStatus(order.status)) {
        return jsonResponse({
          ok: true,
          email_ok: true,
          skip_email: true,
          status: String(order.status),
          order_id: orderId,
        });
      }
      if (order.result_emailed_at) {
        return jsonResponse({ ok: true, email_ok: true, status: "already_emailed", order_id: orderId });
      }
      const { data: generation, error: genErr } = await service
        .from("generations")
        .select("id, status, result_path")
        .eq("id", generationId)
        .maybeSingle();
      if (genErr) throw genErr;
      if (!generation?.result_path || !["completed", "ready", "succeeded", "saved"].includes(String(generation.status))) {
        return jsonResponse({ error: "result_not_ready", ok: false, email_ok: false }, 409);
      }
      const orderAccessToken = await signAccessToken(
        {
          typ: "order",
          id: orderId,
          exp: Math.floor(Date.now() / 1000) + mvpProduct.resultRetentionDays * 24 * 3600,
        },
        accessTokenSecret(),
      );
      const emailResult = await sendResultEmail({
        email: String(order.email),
        orderId,
        accessToken: orderAccessToken,
      });
      if (shouldStampResultEmailedAt(emailResult)) {
        const { data: stamped, error: stampErr } = await service
          .from("mvp_orders")
          .update({ result_emailed_at: new Date().toISOString() })
          .eq("id", orderId)
          .neq("status", "refunded")
          .neq("status", "canceled")
          .select("id");
        if (stampErr) throw stampErr;
        if (persistedRowCount(stamped) < 1) {
          const { data: live, error: liveErr } = await service
            .from("mvp_orders")
            .select("status")
            .eq("id", orderId)
            .maybeSingle();
          if (liveErr) throw liveErr;
          if (isTerminalOrderStatus(live?.status)) {
            return jsonResponse({
              ok: true,
              email_ok: true,
              skip_email: true,
              status: String(live?.status),
              order_id: orderId,
            });
          }
          requirePersistedWrite({ error: null, rowCount: 0, label: "result_emailed_at" });
        }
      }
      return jsonResponse({
        ok: emailResult.ok,
        email_ok: emailResult.ok,
        status: emailResult.ok ? "emailed" : "email_retry",
        order_id: orderId,
        generation_id: generationId,
      }, emailResult.ok ? 200 : 502);
    }

    const { data: claimed, error: claimErr } = await service.rpc("claim_mvp_generation_start", {
      p_generation_id: generationId,
      p_max_attempts: mvpProduct.maxGenerationAttempts,
    });
    if (claimErr) throw claimErr;

    if (!claimed?.run_generation) {
      const kind = String(claimed?.kind || "blocked");
      const ok = kind === "already_complete";
      if (!ok) {
        return jsonResponse({
          ok: false,
          status: "skipped",
          kind,
          generation_id: generationId,
        }, 409);
      }
      const { data: skipOrder, error: skipOrderErr } = await service
        .from("mvp_orders")
        .select("id, status, result_emailed_at")
        .eq("id", orderId)
        .maybeSingle();
      if (skipOrderErr) throw skipOrderErr;
      const skipEmail = isTerminalOrderStatus(skipOrder?.status) || Boolean(skipOrder?.result_emailed_at);
      return jsonResponse({
        ok: true,
        status: "skipped",
        kind,
        skip_email: skipEmail,
        email_ok: skipEmail,
        generation_id: generationId,
        order_id: orderId,
      });
    }
    claimedRun = true;

    const { data: generation, error: genErr } = await service
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .maybeSingle();
    if (genErr) throw genErr;
    if (!generation) {
      await release("generation_not_found");
      return jsonResponse({ error: "generation not found", ok: false }, 404);
    }

    const { data: order, error: orderErr } = await service
      .from("mvp_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) {
      await release("order_not_found");
      return jsonResponse({ error: "order not found", ok: false }, 404);
    }

    const templateId = String(order.template_id || generation.template_id || "").trim();
    if (!templateId) {
      await release("template_required");
      return jsonResponse({ error: "template_required", ok: false }, 400);
    }

    const { data: template, error: templateErr } = await service
      .from("templates")
      .select(`id, prompt, ${TEMPLATE_ACTIVE_COLUMN}, type`)
      .eq("id", templateId)
      .maybeSingle();
    if (templateErr) {
      await release("template_lookup_failed");
      return jsonResponse({ error: "template_lookup_failed", ok: false }, 500);
    }
    const templateCheck = isStillImageTemplate({
      exists: Boolean(template),
      active: template?.isactive === true,
      type: template?.type ?? null,
      prompt: String(order.template_prompt || template?.prompt || ""),
    });
    if (!templateCheck.ok) {
      await release(templateCheck.error);
      return jsonResponse({ error: templateCheck.error, ok: false }, 400);
    }

    const photoBucket = String(order.photo_bucket || UPLOAD_BUCKET);
    const photoPath = String(order.photo_path || "");
    let sourceUrl: string | null = null;
    if (photoPath) {
      sourceUrl = await signedDownloadUrl(service, photoBucket, photoPath);
    }

    const token = Deno.env.get("REPLICATE_API_TOKEN");
    if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");

    let predictionId = reuseExistingPredictionId(generation.replicate_prediction_id);
    let prediction: ReplicatePrediction | null = null;

    if (predictionId) {
      prediction = await getPrediction(token, predictionId);
      if (shouldCreateNewPrediction(prediction.status)) {
        predictionId = null;
        prediction = null;
      } else if (prediction.status !== "succeeded") {
        prediction = await pollPrediction(token, predictionId);
      }
    }

    if (!predictionId) {
      const created = await createPrediction(token, templateCheck.prompt, sourceUrl);
      predictionId = String(created.id || "");
      if (!predictionId) throw new Error("replicate_prediction_id_missing");
      const { data: persistedPrediction, error: persistErr } = await service
        .from("generations")
        .update({
          replicate_prediction_id: predictionId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", generationId)
        .select("id");
      requirePersistedWrite({
        error: persistErr,
        rowCount: persistedRowCount(persistedPrediction),
        label: "replicate_prediction_id",
      });
      prediction = created.status === "succeeded" ? created : await pollPrediction(token, predictionId);
    }

    if (!prediction || prediction.status !== "succeeded") {
      await release(prediction?.error || "replicate_failed");
      return jsonResponse({ error: "replicate_failed", recoverable: true, ok: false }, 502);
    }

    const outputUrl = extractOutputUrl(prediction.output);
    if (!outputUrl) {
      await release("replicate_output_missing");
      return jsonResponse({ error: "replicate_output_missing", recoverable: true, ok: false }, 502);
    }

    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) {
      await release("result_download_failed");
      return jsonResponse({ error: "result_download_failed", recoverable: true, ok: false }, 502);
    }
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const detected = detectStillImageMime(bytes);
    if (!detected.ok) {
      await release("result_not_still_image");
      return jsonResponse({ error: "result_not_still_image", recoverable: true, ok: false }, 502);
    }

    const objectPath = resultObjectPath(orderId, generationId, detected.ext);
    const { error: upErr } = await service.storage
      .from(RESULT_BUCKET)
      .upload(objectPath, bytes, { contentType: detected.mime, upsert: true });
    if (upErr) {
      await release("result_upload_failed");
      return jsonResponse({ error: "result_upload_failed", recoverable: true, ok: false }, 500);
    }

    const signed = await signedDownloadUrl(service, RESULT_BUCKET, objectPath);
    const { data: completed, error: completeErr } = await service.rpc("complete_mvp_fulfillment", {
      p_generation_id: generationId,
      p_order_id: orderId,
      p_result_bucket: RESULT_BUCKET,
      p_result_path: objectPath,
      p_result_mime: detected.mime,
      p_result_image_url: signed,
      p_prediction_id: predictionId,
    });
    if (completeErr || completed?.ok !== true) {
      await release(String(completeErr?.message || completed?.kind || "fulfillment_persist_failed"));
      return jsonResponse({
        error: completeErr?.message || completed?.kind || "fulfillment_persist_failed",
        ok: false,
      }, 500);
    }
    claimedRun = false;

    if (completed.skip_email === true) {
      return jsonResponse({
        ok: true,
        status: String(completed.kind || "skipped"),
        skip_email: true,
        email_ok: true,
        order_id: orderId,
        generation_id: generationId,
        result_mime: detected.mime,
      });
    }

    const { data: liveOrder, error: liveOrderErr } = await service
      .from("mvp_orders")
      .select("id, status")
      .eq("id", orderId)
      .maybeSingle();
    if (liveOrderErr) throw liveOrderErr;
    if (isTerminalOrderStatus(liveOrder?.status)) {
      return jsonResponse({
        ok: true,
        status: String(liveOrder?.status || "skipped"),
        skip_email: true,
        email_ok: true,
        order_id: orderId,
        generation_id: generationId,
        result_mime: detected.mime,
      });
    }

    const orderAccessToken = await signAccessToken(
      {
        typ: "order",
        id: orderId,
        exp: Math.floor(Date.now() / 1000) + mvpProduct.resultRetentionDays * 24 * 3600,
      },
      accessTokenSecret(),
    );

    const emailResult = await sendResultEmail({
      email: String(order.email),
      orderId,
      accessToken: orderAccessToken,
    });
    if (shouldStampResultEmailedAt(emailResult)) {
      const { data: stamped, error: stampErr } = await service
        .from("mvp_orders")
        .update({ result_emailed_at: new Date().toISOString() })
        .eq("id", orderId)
        .neq("status", "refunded")
        .neq("status", "canceled")
        .select("id");
      if (stampErr) throw stampErr;
      if (persistedRowCount(stamped) < 1) {
        const { data: live, error: liveErr } = await service
          .from("mvp_orders")
          .select("status")
          .eq("id", orderId)
          .maybeSingle();
        if (liveErr) throw liveErr;
        if (isTerminalOrderStatus(live?.status)) {
          return jsonResponse({
            ok: true,
            status: String(live?.status || "skipped"),
            skip_email: true,
            email_ok: true,
            order_id: orderId,
            generation_id: generationId,
            result_mime: detected.mime,
          });
        }
        requirePersistedWrite({ error: null, rowCount: 0, label: "result_emailed_at" });
      }
    }

    return jsonResponse({
      ok: true,
      status: "completed",
      order_id: orderId,
      generation_id: generationId,
      result_mime: detected.mime,
      email_ok: emailResult.ok,
      email_skipped: !emailResult.ok,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await release(message);
    } catch (releaseErr) {
      const releaseMessage = releaseErr instanceof Error ? releaseErr.message : String(releaseErr);
      return jsonResponse({ error: message, release_error: releaseMessage, ok: false }, 500);
    }
    return jsonResponse({ error: message, ok: false }, 500);
  }
});
