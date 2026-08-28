import { corsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";

import {
  buildPreviewPrompt,
  resolvePreviewContext,
  type PreviewFunnelContext,
} from "../_shared/pet/previewFunnelContext.ts";

const MODEL = "black-forest-labs/flux-kontext-pro";
const MAX_DATA_URL_CHARS = 2_500_000;
const SESSION_LIMIT = 2;
const IP_DAY_LIMIT = 5;
const POLL_INTERVAL_MS = 2000;
/** ~90s poll; fits Supabase free 150s wall-clock with margin for create/DB/download. */
const POLL_MAX_ITERATIONS = 45;

type AttemptRow = {
  id?: string;
  idempotency_key?: string | null;
  prediction_id?: string | null;
  status?: string | null;
  live_generation?: boolean | null;
  last_error_category?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(
      {
        ok: false,
        mode: "mock",
        errorCode: "invalid_photo",
        error: "That photo could not be used. Try a smaller JPEG, PNG, or WebP.",
      },
      400,
    );
  }

  const imageDataUrl = String(body.imageDataUrl || "");
  const sessionId = String(body.session_id || "").slice(0, 64);
  const resolved = resolvePreviewContext(body);
  if (!resolved.ok) {
    return jsonResponse(
      {
        ok: false,
        mode: "mock",
        errorCode: resolved.errorCode,
        error: resolved.error,
      },
      400,
    );
  }
  const { ctx, species } = resolved;
  const regenerate = Boolean(body.regenerate);
  const clientKey = String(body.idempotency_key || body.preview_attempt_id || "").trim().slice(0, 180);

  if (!imageDataUrl.startsWith("data:image/") || imageDataUrl.length > MAX_DATA_URL_CHARS) {
    return jsonResponse(
      {
        ok: false,
        mode: "mock",
        errorCode: "invalid_photo",
        error: "That photo could not be used. Try a smaller JPEG, PNG, or WebP.",
      },
      400,
    );
  }
  if (/image\/heic|image\/heif/i.test(imageDataUrl)) {
    return jsonResponse(
      {
        ok: false,
        mode: "mock",
        errorCode: "heic_unsupported",
        failureCategory: "invalid_image",
        error:
          "That iPhone HEIC photo couldn’t be used. Choose JPEG/PNG, or enable Most Compatible in Camera Formats.",
      },
      400,
    );
  }

  const token = String(Deno.env.get("REPLICATE_API_TOKEN") || "").trim();
  const liveKill =
    String(Deno.env.get(ctx.liveKillEnv) || "").toLowerCase() === "false" ||
    (ctx.version === "v2" &&
      String(Deno.env.get("PET_V2_PREVIEW_LIVE") || "").toLowerCase() === "false");
  if (liveKill || !token) {
    return jsonResponse({
      ok: false,
      mode: "mock",
      errorCode: "live_disabled",
      error: "Live free-preview generation is off for this environment.",
      remainingSession: SESSION_LIMIT,
    });
  }

  const ip = String(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown")
    .split(",")[0]
    .trim();
  const imageHash = (await hashBytes(imageDataUrl)).slice(0, 48);
  const idempotencyKey =
    clientKey ||
    `preview:${sessionId || "anon"}:${imageHash}${regenerate ? `:regen:${crypto.randomUUID()}` : ""}`;

  // Atomic admit + create gate (migration-required). Never fall back to unlocked Replicate creates.
  const begun = await beginPreviewCreate(ctx, {
    idempotencyKey,
    sessionId,
    ip,
    imageHash,
    species,
  });
  if (!begun) {
    return jsonResponse(
      {
        ok: false,
        mode: "live",
        errorCode: "claim_unavailable",
        failureCategory: "server_error",
        error:
          "Preview claiming is temporarily unavailable. Please try again in a moment — no duplicate charge was started.",
        preview_attempt_id: idempotencyKey,
        retryAfterSeconds: 15,
      },
      503,
    );
  }

  if (begun.action === "quota_denied") {
    const kind = (begun.rate_limit_kind || "unknown") as "session" | "ip" | "image" | "unknown";
    const retryAfterSeconds =
      typeof begun.retry_after_seconds === "number" && begun.retry_after_seconds > 0
        ? begun.retry_after_seconds
        : 1;
    return jsonResponse(
      {
        ok: false,
        mode: "mock",
        errorCode: "rate_limited",
        failureCategory: "rate_limit",
        error: rateLimitMessage(kind, retryAfterSeconds),
        rateLimitKind: kind,
        retryAfterSeconds,
        remainingSession: begun.remaining_session ?? 0,
        remainingIp: begun.remaining_ip ?? 0,
        preview_attempt_id: idempotencyKey,
      },
      429,
    );
  }

  if (begun.action === "orphan_timeout") {
    return jsonResponse({
      ok: false,
      mode: "live",
      errorCode: "claim_orphan",
      failureCategory: "server_error",
      error:
        "A previous attempt for this photo got stuck, and we couldn’t verify whether the preview provider had already started. Replace the photo for a fresh attempt — we won’t start another prediction for this one automatically.",
      preview_attempt_id: idempotencyKey,
    });
  }

  if (begun.action === "claim_unavailable" || begun.action === "invalid" || begun.action === "missing") {
    return jsonResponse(
      {
        ok: false,
        mode: "live",
        errorCode: "claim_unavailable",
        failureCategory: "server_error",
        error:
          "Preview claiming is temporarily unavailable. Please try again in a moment — no duplicate charge was started.",
        preview_attempt_id: idempotencyKey,
        retryAfterSeconds: 15,
      },
      503,
    );
  }

  let claim: AttemptRow | null = {
    idempotency_key: idempotencyKey,
    prediction_id: begun.prediction_id || null,
    status: begun.status || null,
    live_generation: begun.live_generation ?? false,
  };

  if (begun.action === "resume" && begun.prediction_id) {
    const resumed = await resumeExistingAttempt(token, claim, idempotencyKey, ctx);
    if (resumed?.ok && resumed.imageDataUrl) {
      return jsonResponse({
        ok: true,
        mode: "live",
        imageDataUrl: resumed.imageDataUrl,
        remainingSession: begun.remaining_session ?? SESSION_LIMIT,
        estimatedSeconds: 20,
        reused: true,
        preview_attempt_id: idempotencyKey,
      });
    }
    if (resumed && !resumed.ok && !resumed.allowNewPrediction) {
      return jsonResponse({
        ok: false,
        mode: "live",
        errorCode: resumed.errorCode || "generation_failed",
        error:
          resumed.errorCode === "timeout"
            ? "Your preview is still rendering. Wait a moment, then try again — we’ll pick up where it left off."
            : "We couldn't create the preview. Try again.",
        failureCategory: resumed.failureCategory || resumed.errorCode || "provider_error",
        preview_attempt_id: idempotencyKey,
      });
    }
    // allowNewPrediction after terminal provider failure clears prediction in resume —
    // require a fresh begin on retry rather than creating unlocked here.
    if (resumed?.allowNewPrediction) {
      await markAttempt(ctx, idempotencyKey, {
        status: "failed",
        liveGeneration: false,
        lastErrorCategory: "provider_error",
        clearPrediction: true,
      });
      return jsonResponse({
        ok: false,
        mode: "live",
        errorCode: "generation_failed",
        failureCategory: "provider_error",
        error: "We couldn't finish that preview. Tap Try again to start a safe retry.",
        preview_attempt_id: idempotencyKey,
      });
    }
  }

  if (begun.action === "wait") {
    const waited = await waitForSiblingPrediction(ctx, token, idempotencyKey, claim);
    if (waited) return waited;
    return jsonResponse({
      ok: false,
      mode: "live",
      errorCode: "timeout",
      failureCategory: "timeout",
      error:
        "Your preview is still rendering. Wait a moment, then try again — we’ll pick up where it left off.",
      preview_attempt_id: idempotencyKey,
    });
  }

  if (begun.action !== "create") {
    return jsonResponse(
      {
        ok: false,
        mode: "live",
        errorCode: "claim_unavailable",
        failureCategory: "server_error",
        error:
          "Preview claiming is temporarily unavailable. Please try again in a moment — no duplicate charge was started.",
        preview_attempt_id: idempotencyKey,
        retryAfterSeconds: 15,
      },
      503,
    );
  }

  try {
    const outputUrl = await runKontextPreview(ctx, token, imageDataUrl, species, idempotencyKey);
    const image = await downloadAsDataUrl(outputUrl.url);
    const marked = await markAttempt(ctx, idempotencyKey, {
      status: "succeeded",
      predictionId: outputUrl.predictionId,
      liveGeneration: true,
    });
    if (!marked) {
      await insertLegacySuccessfulAttempt(ctx, {
        sessionId,
        ip,
        imageHash,
        species,
        idempotencyKey,
        predictionId: outputUrl.predictionId,
      });
    }
    await recordSuccessfulQuota(ctx, { sessionId, ip, imageHash });
    return jsonResponse({
      ok: true,
      mode: "live",
      imageDataUrl: image,
      remainingSession: Math.max(0, (begun.remaining_session ?? SESSION_LIMIT - 1)),
      estimatedSeconds: 20,
      preview_attempt_id: idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview generation failed.";
    const keepProcessing =
      Boolean(error && typeof error === "object" && (error as { keepProcessing?: boolean }).keepProcessing) ||
      classifyGenerationError(message) === "timeout";
    const errorCode =
      (error && typeof error === "object" && (error as { errorCode?: string }).errorCode) ||
      classifyGenerationError(message);
    const predictionId =
      error && typeof error === "object" && "predictionId" in error
        ? String((error as { predictionId?: string }).predictionId || "")
        : "";
    if (!keepProcessing) {
      await markAttempt(ctx, idempotencyKey, {
        status: "failed",
        predictionId: predictionId || undefined,
        liveGeneration: false,
        lastErrorCategory: errorCode === "provider_state_persist_failed" ? "server_error" : errorCode,
      });
    }
    return jsonResponse({
      ok: false,
      mode: "live",
      errorCode: errorCode === "provider_state_persist_failed" ? "provider_state_persist_failed" : errorCode,
      error:
        errorCode === "provider_state_persist_failed"
          ? "We started a preview but couldn’t save its provider state. Replace the photo for a fresh attempt — we won’t start another prediction for this one automatically."
          : errorCode === "timeout"
            ? "Your preview is still rendering. Wait a moment, then try again — we’ll pick up where it left off."
            : "We couldn't create the preview. Try again.",
      failureCategory:
        errorCode === "provider_state_persist_failed" || errorCode === "timeout"
          ? errorCode === "timeout"
            ? "timeout"
            : "server_error"
          : errorCode,
      preview_attempt_id: idempotencyKey,
    });
  }
});

function classifyGenerationError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized")) {
    return "provider_auth";
  }
  if (lower.includes("too long") || lower.includes("timeout")) return "timeout";
  if (lower.includes("rate") || lower.includes("429")) return "rate_limit";
  if (lower.includes("invalid") && lower.includes("image")) return "invalid_image";
  return "provider_error";
}

async function resumeExistingAttempt(
  token: string,
  claim: AttemptRow,
  idempotencyKey: string,
  ctx: PreviewFunnelContext,
): Promise<{
  ok: boolean;
  imageDataUrl?: string;
  blockCreate?: boolean;
  allowNewPrediction?: boolean;
  errorCode?: string;
  failureCategory?: string;
} | null> {
  const status = String(claim.status || "");
  const predictionId = String(claim.prediction_id || "").trim();

  if (status === "succeeded" && predictionId) {
    try {
      const url = await fetchPredictionOutput(token, predictionId);
      if (url) {
        const image = await downloadAsDataUrl(url);
        if (!claim.live_generation) {
          await markAttempt(ctx, idempotencyKey, {
            status: "succeeded",
            predictionId,
            liveGeneration: true,
          });
        }
        return { ok: true, imageDataUrl: image };
      }
    } catch {
      /* output URL may have expired — allow a replacement generation */
    }
    await markAttempt(ctx, idempotencyKey, {
      status: "pending",
      liveGeneration: false,
      lastErrorCategory: "provider_error",
      clearPrediction: true,
    });
    return {
      ok: false,
      allowNewPrediction: true,
      errorCode: "generation_failed",
      failureCategory: "provider_error",
    };
  }

  if ((status === "pending" || status === "processing") && predictionId) {
    try {
      const polled = await pollPrediction(token, predictionId);
      if (polled.url) {
        const image = await downloadAsDataUrl(polled.url);
        await markAttempt(ctx, idempotencyKey, {
          status: "succeeded",
          predictionId,
          liveGeneration: true,
        });
        await recordSuccessfulQuotaFromClaim(ctx, claim);
        return { ok: true, imageDataUrl: image };
      }
      await markAttempt(ctx, idempotencyKey, {
        status: "failed",
        predictionId,
        liveGeneration: false,
        lastErrorCategory: polled.errorCode || "provider_error",
      });
      return {
        ok: false,
        allowNewPrediction: false,
        errorCode: polled.errorCode || "provider_error",
        failureCategory: polled.errorCode || "provider_error",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "timeout";
      const errorCode = classifyGenerationError(message);
      // Still running / timed out waiting — do not create a second prediction.
      return {
        ok: false,
        allowNewPrediction: false,
        errorCode,
        failureCategory: errorCode,
      };
    }
  }

  if (status === "failed" && predictionId) {
    try {
      const existing = await getPrediction(token, predictionId);
      if (existing.status === "succeeded") {
        const url = replicateOutputUrl(existing.output);
        if (url) {
          const image = await downloadAsDataUrl(url);
          await markAttempt(ctx, idempotencyKey, {
            status: "succeeded",
            predictionId,
            liveGeneration: true,
          });
          await recordSuccessfulQuotaFromClaim(ctx, claim);
          return { ok: true, imageDataUrl: image };
        }
      }
      if (existing.status === "starting" || existing.status === "processing") {
        const polled = await pollPrediction(token, predictionId);
        if (polled.url) {
          const image = await downloadAsDataUrl(polled.url);
          await markAttempt(ctx, idempotencyKey, {
            status: "succeeded",
            predictionId,
            liveGeneration: true,
          });
          await recordSuccessfulQuotaFromClaim(ctx, claim);
          return { ok: true, imageDataUrl: image };
        }
        if (polled.errorCode === "timeout") {
          await markAttempt(ctx, idempotencyKey, {
            status: "processing",
            predictionId,
            liveGeneration: false,
          });
          return {
            ok: false,
            allowNewPrediction: false,
            errorCode: "timeout",
            failureCategory: "timeout",
          };
        }
      }
      // Terminal provider failure for this prediction — allow one replacement create.
      await markAttempt(ctx, idempotencyKey, {
        status: "pending",
        liveGeneration: false,
        lastErrorCategory: String(claim.last_error_category || "provider_error"),
        clearPrediction: true,
      });
      return { ok: false, allowNewPrediction: true };
    } catch {
      return {
        ok: false,
        allowNewPrediction: false,
        errorCode: String(claim.last_error_category || "provider_error"),
        failureCategory: String(claim.last_error_category || "provider_error"),
      };
    }
  }

  // pending/failed without prediction_id → safe to create for this same key
  if ((status === "pending" || status === "failed") && !predictionId) {
    return { ok: false, allowNewPrediction: true };
  }

  return null;
}

async function runKontextPreview(
  ctx: PreviewFunnelContext,
  token: string,
  imageDataUrl: string,
  species: string,
  idempotencyKey: string,
): Promise<{ url: string; predictionId: string }> {
  const prompt = buildPreviewPrompt(ctx, species);

  const created = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey.slice(0, 64),
    },
    body: JSON.stringify({
      input: {
        prompt,
        input_image: imageDataUrl,
        aspect_ratio: "match_input_image",
        output_format: "jpg",
        prompt_upsampling: false,
        safety_tolerance: 2,
      },
    }),
  });
  const createdJson = (await created.json()) as {
    id?: string;
    status?: string;
    error?: string;
    output?: unknown;
  };
  if (!created.ok || !createdJson.id) {
    throw new Error(
      `${created.status}: ${String(createdJson.error || "Could not start the preview.")}`,
    );
  }

  const persisted = await markAttempt(ctx, idempotencyKey, {
    status: "processing",
    predictionId: createdJson.id,
    liveGeneration: false,
  });
  if (!persisted) {
    await cancelReplicatePrediction(token, createdJson.id);
    const err = new Error("provider_state_persist_failed") as Error & {
      predictionId?: string;
      errorCode?: string;
      keepProcessing?: boolean;
    };
    err.predictionId = createdJson.id;
    err.errorCode = "provider_state_persist_failed";
    err.keepProcessing = false;
    throw err;
  }

  try {
    const polled = await pollPrediction(token, createdJson.id);
    if (polled.url) {
      return { url: polled.url, predictionId: createdJson.id };
    }
    // Keep processing on wait-timeout so retry resumes the same prediction.
    if (polled.errorCode === "timeout") {
      await markAttempt(ctx, idempotencyKey, {
        status: "processing",
        predictionId: createdJson.id,
        liveGeneration: false,
      });
    } else {
      await markAttempt(ctx, idempotencyKey, {
        status: "failed",
        predictionId: createdJson.id,
        liveGeneration: false,
        lastErrorCategory: polled.errorCode || "provider_error",
      });
    }
    const err = new Error(polled.error || "Preview generation failed.") as Error & {
      predictionId?: string;
      errorCode?: string;
      keepProcessing?: boolean;
    };
    err.predictionId = createdJson.id;
    err.errorCode = polled.errorCode;
    err.keepProcessing = polled.errorCode === "timeout";
    throw err;
  } catch (error) {
    if (error && typeof error === "object") {
      (error as { predictionId?: string }).predictionId = createdJson.id;
    }
    throw error;
  }
}

async function cancelReplicatePrediction(token: string, predictionId: string): Promise<void> {
  await fetch(`https://api.replicate.com/v1/predictions/${predictionId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

async function pollPrediction(
  token: string,
  predictionId: string,
): Promise<{ url: string | null; error?: string; errorCode?: string }> {
  for (let i = 0; i < POLL_MAX_ITERATIONS; i += 1) {
    await sleep(POLL_INTERVAL_MS);
    const json = await getPrediction(token, predictionId);
    if (json.status === "succeeded") {
      const url = replicateOutputUrl(json.output);
      if (!url) return { url: null, error: "The preview finished without an image.", errorCode: "provider_error" };
      return { url };
    }
    if (json.status === "failed" || json.status === "canceled") {
      return {
        url: null,
        error: String(json.error || "Preview generation failed."),
        errorCode: "provider_error",
      };
    }
  }
  return { url: null, error: "The preview is taking too long. Try again.", errorCode: "timeout" };
}

async function getPrediction(
  token: string,
  predictionId: string,
): Promise<{ status?: string; error?: string; output?: unknown }> {
  const poll = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await poll.json()) as { status?: string; error?: string; output?: unknown };
}

async function fetchPredictionOutput(token: string, predictionId: string): Promise<string | null> {
  const json = await getPrediction(token, predictionId);
  if (json.status !== "succeeded") return null;
  return replicateOutputUrl(json.output);
}

function replicateOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && output.startsWith("http")) return output;
  if (Array.isArray(output)) {
    const first = output.find((item) => typeof item === "string" && item.startsWith("http"));
    if (typeof first === "string") return first;
  }
  return null;
}

async function downloadAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download the preview.");
  const buffer = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

async function beginPreviewCreate(
  ctx: PreviewFunnelContext,
  input: {
    idempotencyKey: string;
    sessionId: string;
    ip: string;
    imageHash: string;
    species: string;
  },
): Promise<{
  action: string;
  prediction_id?: string;
  status?: string;
  live_generation?: boolean;
  rate_limit_kind?: string;
  retry_after_seconds?: number;
  remaining_session?: number;
  remaining_ip?: number;
  error_code?: string;
  failure_category?: string;
} | null> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  // Fail closed: never create provider predictions without the atomic RPC.
  if (!supabaseUrl || !serviceKey) return null;

  const ipHash = await hashIp(ctx, input.ip);
  const beginRpc =
    ctx.version === "v3" ? "begin_pet_v3_preview_create" : "begin_pet_v2_preview_create";
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${beginRpc}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_idempotency_key: input.idempotencyKey,
      p_session_id: input.sessionId.slice(0, 64),
      p_ip_hash: ipHash,
      p_image_hash: input.imageHash,
      p_species: input.species,
      p_scene_key: ctx.sceneKey,
      p_session_limit: SESSION_LIMIT,
      p_ip_limit: IP_DAY_LIMIT,
      p_image_limit: SESSION_LIMIT,
      p_orphan_seconds: 90,
    }),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || typeof json.action !== "string") return null;
  return {
    action: String(json.action),
    prediction_id: json.prediction_id ? String(json.prediction_id) : undefined,
    status: json.status ? String(json.status) : undefined,
    live_generation: Boolean(json.live_generation),
    rate_limit_kind: json.rate_limit_kind ? String(json.rate_limit_kind) : undefined,
    retry_after_seconds:
      typeof json.retry_after_seconds === "number" ? json.retry_after_seconds : undefined,
    remaining_session:
      typeof json.remaining_session === "number" ? json.remaining_session : undefined,
    remaining_ip: typeof json.remaining_ip === "number" ? json.remaining_ip : undefined,
    error_code: json.error_code ? String(json.error_code) : undefined,
    failure_category: json.failure_category ? String(json.failure_category) : undefined,
  };
}

function rateLimitMessage(kind: "session" | "ip" | "image" | "unknown", retryAfterSeconds: number): string {
  const hours = Math.max(1, Math.ceil(retryAfterSeconds / 3600));
  if (kind === "session") {
    return `This browser session already used its free previews (2 per 24 hours). Unlock the collection, or try again in about ${hours} hour${hours === 1 ? "" : "s"}.`;
  }
  if (kind === "ip") {
    return `This network reached today’s free-preview limit (5 per 24 hours). Try again in about ${hours} hour${hours === 1 ? "" : "s"}, or unlock the collection.`;
  }
  if (kind === "image") {
    return `That photo already received a free preview today. Try a different photo, or unlock the collection.`;
  }
  return `Free preview limit reached. Try again in about ${hours} hour${hours === 1 ? "" : "s"}, or unlock the collection.`;
}

async function waitForSiblingPrediction(
  ctx: PreviewFunnelContext,
  token: string,
  idempotencyKey: string,
  claim: AttemptRow | null,
): Promise<Response | null> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return null;

  for (let i = 0; i < 20; i += 1) {
    await sleep(1500);
    const row = await getAttemptByKey(ctx, supabaseUrl, serviceKey, idempotencyKey);
    if (!row) continue;
    if (row.prediction_id) {
      const resumed = await resumeExistingAttempt(
        token,
        { ...(claim || {}), ...row },
        idempotencyKey,
        ctx,
      );
      if (resumed?.ok && resumed.imageDataUrl) {
        return jsonResponse({
          ok: true,
          mode: "live",
          imageDataUrl: resumed.imageDataUrl,
          remainingSession: SESSION_LIMIT,
          estimatedSeconds: 20,
          reused: true,
          preview_attempt_id: idempotencyKey,
        });
      }
      if (resumed && !resumed.ok && !resumed.allowNewPrediction) {
        return jsonResponse({
          ok: false,
          mode: "live",
          errorCode: resumed.errorCode || "timeout",
          failureCategory: resumed.failureCategory || resumed.errorCode || "timeout",
          error:
            resumed.errorCode === "timeout"
              ? "Your preview is still rendering. Wait a moment, then try again — we’ll pick up where it left off."
              : "We couldn't create the preview. Try again.",
          preview_attempt_id: idempotencyKey,
        });
      }
    }
    if (row.status === "failed" && !row.prediction_id) {
      return null;
    }
    if (row.status === "succeeded" && row.prediction_id) {
      continue;
    }
  }
  return null;
}

async function getAttemptByKey(
  ctx: PreviewFunnelContext,
  supabaseUrl: string,
  serviceKey: string,
  idempotencyKey: string,
): Promise<AttemptRow | null> {
  const url =
    `${supabaseUrl}/rest/v1/${ctx.attemptsTable}` +
    `?select=id,idempotency_key,prediction_id,status,live_generation,last_error_category,session_id,ip_hash,image_hash` +
    `&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const rows = (await res.json().catch(() => [])) as AttemptRow[];
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function markAttempt(
  ctx: PreviewFunnelContext,
  idempotencyKey: string,
  patch: {
    status: string;
    predictionId?: string;
    liveGeneration?: boolean;
    lastErrorCategory?: string;
    clearPrediction?: boolean;
  },
): Promise<boolean> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return false;

  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/${ctx.updateRpc}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_idempotency_key: idempotencyKey,
      p_status: patch.status,
      p_prediction_id: patch.clearPrediction ? null : patch.predictionId || null,
      p_live_generation: patch.liveGeneration ?? null,
      p_last_error_category: patch.lastErrorCategory || null,
      p_clear_prediction: Boolean(patch.clearPrediction),
    }),
  }).catch(() => null);
  if (rpc && rpc.ok) return true;

  const body: Record<string, unknown> = {
    status: patch.status,
    provider: "replicate",
  };
  if (patch.clearPrediction) body.prediction_id = null;
  else if (patch.predictionId) body.prediction_id = patch.predictionId;
  if (typeof patch.liveGeneration === "boolean") body.live_generation = patch.liveGeneration;
  if (patch.status === "failed") body.last_error_category = patch.lastErrorCategory || null;
  if (patch.status === "succeeded" || patch.status === "failed") {
    body.completed_at = new Date().toISOString();
  }
  if (patch.status === "pending" || patch.status === "processing") {
    body.completed_at = null;
  }
  const patched = await fetch(
    `${supabaseUrl}/rest/v1/${ctx.attemptsTable}?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    },
  ).catch(() => null);
  return Boolean(patched && patched.ok);
}

async function insertLegacySuccessfulAttempt(
  ctx: PreviewFunnelContext,
  input: {
  sessionId: string;
  ip: string;
  imageHash: string;
  species: string;
  idempotencyKey: string;
  predictionId: string;
}): Promise<void> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return;
  const ipHash = await hashIp(ctx, input.ip);
  const payload: Record<string, unknown> = {
    session_id: input.sessionId.slice(0, 64),
    ip_hash: ipHash,
    image_hash: input.imageHash,
    species: input.species,
    scene_key: ctx.sceneKey,
    live_generation: true,
  };
  // Prefer enriched row when migration is present; fall back to legacy columns only.
  const enriched = {
    ...payload,
    idempotency_key: input.idempotencyKey,
    prediction_id: input.predictionId,
    status: "succeeded",
    provider: "replicate",
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  };
  const first = await fetch(`${supabaseUrl}/rest/v1/${ctx.attemptsTable}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(enriched),
  }).catch(() => null);
  if (first && first.ok) return;
  await fetch(`${supabaseUrl}/rest/v1/${ctx.attemptsTable}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

async function recordSuccessfulQuota(
  ctx: PreviewFunnelContext,
  input: {
  sessionId: string;
  ip: string;
  imageHash: string;
}): Promise<void> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return;
  const ipHash = await hashIp(ctx, input.ip);
  await Promise.all([
    touchLimit(supabaseUrl, serviceKey, `${ctx.rateLimitPrefix}:session:${input.sessionId || "anon"}`, SESSION_LIMIT),
    touchLimit(supabaseUrl, serviceKey, `${ctx.rateLimitPrefix}:ip:${ipHash}`, IP_DAY_LIMIT),
    touchLimit(supabaseUrl, serviceKey, `${ctx.rateLimitPrefix}:img:${input.imageHash.slice(0, 32)}`, SESSION_LIMIT),
  ]);
}

async function recordSuccessfulQuotaFromClaim(ctx: PreviewFunnelContext, claim: AttemptRow): Promise<void> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return;
  const sessionId = String((claim as { session_id?: string }).session_id || "");
  const ipHash = String((claim as { ip_hash?: string }).ip_hash || "");
  const imageHash = String((claim as { image_hash?: string }).image_hash || "");
  await Promise.all([
    touchLimit(supabaseUrl, serviceKey, `${ctx.rateLimitPrefix}:session:${sessionId || "anon"}`, SESSION_LIMIT),
    ipHash ? touchLimit(supabaseUrl, serviceKey, `${ctx.rateLimitPrefix}:ip:${ipHash}`, IP_DAY_LIMIT) : Promise.resolve(),
    imageHash
      ? touchLimit(supabaseUrl, serviceKey, `${ctx.rateLimitPrefix}:img:${imageHash.slice(0, 32)}`, SESSION_LIMIT)
      : Promise.resolve(),
  ]);
}

async function touchLimit(
  supabaseUrl: string,
  serviceKey: string,
  key: string,
  limit: number,
): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/rpc/touch_edge_rate_limit`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_key: key, p_limit: limit, p_window_seconds: 60 * 60 * 24 }),
  }).catch(() => undefined);
}

async function hashBytes(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashIp(ctx: PreviewFunnelContext, ip: string): Promise<string> {
  return (await hashBytes(`${ctx.rateLimitPrefix}:${ip}`)).slice(0, 32);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void corsHeaders;
