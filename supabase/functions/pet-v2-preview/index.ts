import { corsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";

import {
  buildPreviewPrompt,
  PET_PREVIEW_IDENTITY_BUILD,
  resolvePreviewContext,
  type PreviewFunnelContext,
} from "../_shared/pet/previewFunnelContext.ts";
import {
  decodePreviewDataUrl,
  previewDiag,
} from "../_shared/pet/previewImage.ts";
import { unclearSpeciesMessage, validatePetSpecies } from "../_shared/pet/speciesValidate.ts";

const DEFAULT_MODEL = "black-forest-labs/flux-kontext-pro";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1";
const SESSION_LIMIT = 2;
const IP_DAY_LIMIT = 5;
const POLL_INTERVAL_MS = 2000;
/** Keep under edge idle timeout with margin for species vision + download. */
const POLL_MAX_ITERATIONS = 35;
const REPLICATE_FETCH_TIMEOUT_MS = 25_000;
/** Replicate create retries when the account is briefly throttled. */
const REPLICATE_CREATE_ATTEMPTS = 3;
/** Base backoff before jitter (attempt index 0 waits before 2nd try). */
const REPLICATE_CREATE_BACKOFF_MS = [1000, 3000, 8000];
const REPLICATE_CREATE_MAX_WAIT_MS = 30_000;

function previewModel(): string {
  return (Deno.env.get("PET_PREVIEW_IMAGE_MODEL") || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function openAiImageModel(): string {
  return (
    (Deno.env.get("PET_PREVIEW_OPENAI_IMAGE_MODEL") || DEFAULT_OPENAI_IMAGE_MODEL).trim() ||
    DEFAULT_OPENAI_IMAGE_MODEL
  );
}

function openAiFallbackEnabled(): boolean {
  // Opt-in only. Production free previews run on Replicate; do not treat OpenAI as redundancy.
  return String(Deno.env.get("PET_PREVIEW_OPENAI_FALLBACK") || "").toLowerCase() === "true";
}

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
  if (req.method === "GET") {
    return jsonResponse({
      ok: true,
      service: "pet-v2-preview",
      identityBuild: PET_PREVIEW_IDENTITY_BUILD,
    });
  }
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
    previewDiag({
      stage: "funnel_reject",
      errorCode: resolved.errorCode,
      declaredSpecies: String(body.species || ""),
      funnelVersion: String(body.funnel_version || ""),
      scene: String(body.scene || ""),
    });
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

  const decoded = decodePreviewDataUrl(imageDataUrl);
  if (!decoded.ok) {
    previewDiag({
      stage: "image_decode_failed",
      funnel: ctx.version,
      scene: ctx.sceneKey,
      speciesDeclared: species,
      errorCode: decoded.errorCode,
      dataUrlChars: imageDataUrl.length,
    });
    return jsonResponse(
      {
        ok: false,
        mode: "mock",
        errorCode: decoded.errorCode,
        error: decoded.error,
        failureCategory: "invalid_image",
      },
      400,
    );
  }

  // Species gate before any paid Replicate call. Blocks when vision cannot verify species.
  const expectedSpecies = species === "cat" || species === "dog" || species === "other" ? species : "dog";
  const speciesCheck = await validatePetSpecies({
    imageDataUrl,
    expected: expectedSpecies,
  });
  previewDiag({
    stage: "species_check",
    funnel: ctx.version,
    scene: ctx.sceneKey,
    speciesDeclared: species,
    speciesDetected: speciesCheck.detected,
    speciesConfidence: Number(speciesCheck.confidence.toFixed(3)),
    speciesAction: speciesCheck.action,
    speciesProvider: speciesCheck.provider,
    speciesVisionWarning:
      speciesCheck.ok && "visionWarning" in speciesCheck ? speciesCheck.visionWarning || null : null,
    imageBytes: decoded.image.byteLength,
    imageMagic: decoded.image.magic,
    imageMime: decoded.image.mime,
  });
  if (!speciesCheck.ok) {
    // errorCode is wrong_species | unclear_species — never start Replicate.
    return jsonResponse(
      {
        ok: false,
        mode: "mock",
        errorCode: speciesCheck.errorCode,
        error: speciesCheck.error,
        failureCategory: speciesCheck.errorCode === "wrong_species" ? "wrong_species" : "invalid_image",
        speciesDetected: speciesCheck.detected,
        speciesConfidence: speciesCheck.confidence,
        speciesProvider: speciesCheck.provider,
        retryable: speciesCheck.errorCode === "unclear_species",
      },
      400,
    );
  }
  // When vision is down, refuse Cat V3 / Dog V2 cross-risk by requiring a clearer verified photo
  // only for mismatched funnel attempts is impossible without vision — so Cat V3 hard-requires
  // a working classifier (do not generate royal portraits for unverified species).
  if (
    ctx.version === "v3" &&
    speciesCheck.provider === "skipped" &&
    String(Deno.env.get("PET_V3_REQUIRE_SPECIES_VISION") || "true").toLowerCase() !== "false"
  ) {
    return jsonResponse(
      {
        ok: false,
        mode: "mock",
        errorCode: "unclear_species",
        error: unclearSpeciesMessage(),
        failureCategory: "invalid_image",
        speciesDetected: "unclear",
        speciesConfidence: 0,
        speciesProvider: "skipped",
        retryable: true,
        providerDetail: String(
          ("visionWarning" in speciesCheck && speciesCheck.visionWarning) ||
            "species vision unavailable",
        ).slice(0, 180),
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

  // Idempotency must stay tied to this upload/session — refuse keys from another session.
  if (clientKey && sessionId && clientKey.startsWith("preview:") && !clientKey.startsWith(`preview:${sessionId}:`)) {
    previewDiag({
      stage: "idempotency_session_mismatch",
      funnel: ctx.version,
      sessionPrefix: sessionId.slice(0, 8),
      keyPrefix: clientKey.slice(0, 24),
    });
    return jsonResponse(
      {
        ok: false,
        mode: "mock",
        errorCode: "invalid_photo",
        error: "That preview request did not match this session. Re-attach the photo and try again.",
        failureCategory: "invalid_image",
      },
      400,
    );
  }

  const limited = await assertPreviewLimits(ctx, sessionId, ip, imageHash, idempotencyKey);
  if (!limited.ok) {
    return jsonResponse(
      {
        ok: false,
        mode: "mock",
        errorCode: "rate_limited",
        error: limited.message,
        remainingSession: limited.remainingSession,
        remainingIp: limited.remainingIp,
      },
      429,
    );
  }

  let claim = await claimAttempt(ctx, {
    idempotencyKey,
    sessionId,
    ip,
    imageHash,
    species,
  });

  if (claim) {
    const resumed = await resumeExistingAttempt(token, claim, idempotencyKey, ctx);
    if (resumed) {
      if (resumed.ok && resumed.imageDataUrl) {
        return jsonResponse({
          ok: true,
          mode: "live",
          identityBuild: PET_PREVIEW_IDENTITY_BUILD,
          imageDataUrl: resumed.imageDataUrl,
          remainingSession: Math.max(
            0,
            (limited.remainingSession ?? SESSION_LIMIT) - (claim.live_generation ? 0 : 1),
          ),
          estimatedSeconds: 20,
          reused: true,
          preview_attempt_id: idempotencyKey,
        });
      }
      if (!resumed.ok && resumed.blockCreate) {
        return jsonResponse({
          ok: false,
          mode: "live",
          errorCode: resumed.errorCode || "generation_failed",
          error: "We couldn't create the preview. Try again.",
          failureCategory: resumed.failureCategory || resumed.errorCode || "provider_error",
          preview_attempt_id: idempotencyKey,
        });
      }
      if (!resumed.ok && !resumed.allowNewPrediction) {
        return jsonResponse({
          ok: false,
          mode: "live",
          errorCode: resumed.errorCode || "generation_failed",
          error: "We couldn't create the preview. Try again.",
          failureCategory: resumed.failureCategory || resumed.errorCode || "provider_error",
          preview_attempt_id: idempotencyKey,
        });
      }
      // allowNewPrediction: refresh claim so stale prediction_id cannot block create.
      if (resumed.allowNewPrediction) {
        claim = {
          ...claim,
          status: "pending",
          prediction_id: null,
        };
      }
    }
  }

  // Recover if resume returned null but a stale provider row would block create.
  if (
    claim?.prediction_id &&
    (claim.status === "pending" || claim.status === "processing" || claim.status === "succeeded")
  ) {
    await markAttempt(ctx, idempotencyKey, {
      status: "pending",
      liveGeneration: false,
      lastErrorCategory: "server_error",
      clearPrediction: true,
    });
    claim = { ...claim, status: "pending", prediction_id: null };
  }

  try {
    const generatedAt = Date.now();
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
    const latencyMs = Date.now() - generatedAt;
    previewDiag({
      stage: "preview_succeeded",
      funnel: ctx.version,
      latencyMs,
      providerStatus: "succeeded",
      predictionPrefix: String(outputUrl.predictionId).slice(0, 12),
    });
    return jsonResponse({
      ok: true,
      mode: "live",
      identityBuild: PET_PREVIEW_IDENTITY_BUILD,
      imageDataUrl: image,
      remainingSession: Math.max(0, (limited.remainingSession ?? SESSION_LIMIT) - 1),
      estimatedSeconds: 20,
      preview_attempt_id: idempotencyKey,
      provider: String(outputUrl.predictionId).startsWith("openai-") ? "openai" : "replicate",
      providerStatus: "succeeded",
      latencyMs,
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
        lastErrorCategory: errorCode,
      });
    }
    const retryable =
      keepProcessing ||
      errorCode === "rate_limit" ||
      errorCode === "timeout" ||
      errorCode === "provider_error" ||
      errorCode === "server_error";
    const providerStatus =
      errorCode === "rate_limit"
        ? "rate_limited"
        : keepProcessing || errorCode === "timeout"
          ? "timeout"
          : "failed";
    const userError =
      errorCode === "timeout"
        ? "Your preview is still rendering. Tap Try again — we’ll pick up where it left off."
        : errorCode === "rate_limit"
          ? "The preview service is busy. Tap Try again in a moment — this usually clears quickly."
          : "We couldn't create the preview. Try again.";
    previewDiag({
      stage: "preview_failed",
      funnel: ctx.version,
      errorCode,
      providerStatus,
      retryable,
    });
    return jsonResponse({
      ok: false,
      mode: "live",
      errorCode,
      error: userError,
      failureCategory: errorCode,
      retryable,
      providerStatus,
      // Short provider hint for ops/smoke only — never includes tokens or image bytes.
      providerDetail: message.slice(0, 180),
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

  // Hard guarantee: never create a text-only prediction. input_image is mandatory.
  if (!imageDataUrl.startsWith("data:image/")) {
    const err = new Error("Reference image missing for preview generation.") as Error & {
      errorCode?: string;
    };
    err.errorCode = "invalid_image";
    throw err;
  }

  try {
    const preferred = String(Deno.env.get("PET_PREVIEW_PREFERRED_PROVIDER") || "")
      .trim()
      .toLowerCase();
    if (preferred === "openai" && openAiFallbackEnabled()) {
      const openaiKey = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
      if (openaiKey) {
        try {
          previewDiag({
            stage: "openai_preferred_start",
            funnel: ctx.version,
            scene: ctx.sceneKey,
            speciesDeclared: species,
          });
          const preferredResult = await runOpenAiIdentityEdit(imageDataUrl, prompt);
          await markAttempt(ctx, idempotencyKey, {
            status: "processing",
            predictionId: preferredResult.predictionId,
            liveGeneration: false,
          });
          return preferredResult;
        } catch (preferredError) {
          previewDiag({
            stage: "openai_preferred_failed",
            funnel: ctx.version,
            error: String(
              preferredError instanceof Error ? preferredError.message : preferredError,
            ).slice(0, 120),
          });
          // Fall through to Replicate — OpenAI billing/throttle must not hard-block previews.
        }
      }
    }
    return await runReplicateKontext(ctx, token, imageDataUrl, species, idempotencyKey, prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    const rateLimited = classifyGenerationError(message) === "rate_limit";
    const openaiKey = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
    if (!rateLimited || !openAiFallbackEnabled() || !openaiKey) {
      throw error;
    }

    previewDiag({
      stage: "openai_fallback_start",
      funnel: ctx.version,
      scene: ctx.sceneKey,
      speciesDeclared: species,
      replicateError: message.slice(0, 120),
    });

    const fallback = await runOpenAiIdentityEdit(imageDataUrl, prompt);
    await markAttempt(ctx, idempotencyKey, {
      status: "processing",
      predictionId: fallback.predictionId,
      liveGeneration: false,
    });
    previewDiag({
      stage: "openai_fallback_ok",
      funnel: ctx.version,
      predictionPrefix: fallback.predictionId.slice(0, 18),
    });
    return fallback;
  }
}

async function runReplicateKontext(
  ctx: PreviewFunnelContext,
  token: string,
  imageDataUrl: string,
  species: string,
  idempotencyKey: string,
  prompt: string,
): Promise<{ url: string; predictionId: string }> {
  const model = previewModel();
  const input = {
    prompt,
    input_image: imageDataUrl,
    aspect_ratio: "match_input_image",
    output_format: "jpg",
    prompt_upsampling: false,
    safety_tolerance: 2,
  };

  previewDiag({
    stage: "provider_create",
    funnel: ctx.version,
    scene: ctx.sceneKey,
    speciesDeclared: species,
    model,
    hasInputImage: Boolean(input.input_image),
    inputImageChars: imageDataUrl.length,
    promptChars: prompt.length,
    idempotencyPrefix: idempotencyKey.slice(0, 24),
  });

  const createdJson = await createReplicatePrediction(token, model, input, idempotencyKey, ctx);

  // Confirm the provider accepted an image-conditioned request (no silent text-only).
  const acceptedImage =
    typeof createdJson.input?.input_image === "string" &&
    createdJson.input.input_image.length > 0;
  previewDiag({
    stage: "provider_create_ok",
    funnel: ctx.version,
    model,
    predictionPrefix: String(createdJson.id).slice(0, 12),
    providerAcceptedInputImage: acceptedImage || createdJson.input === undefined,
  });
  // Replicate may omit echoed input in create response; still refuse if it explicitly
  // acknowledges a create without input_image when input is present in the response.
  if (createdJson.input && !acceptedImage) {
    const err = new Error("Provider did not accept the reference image.") as Error & {
      errorCode?: string;
      predictionId?: string;
    };
    err.errorCode = "provider_error";
    err.predictionId = createdJson.id;
    throw err;
  }

  await markAttempt(ctx, idempotencyKey, {
    status: "processing",
    predictionId: createdJson.id,
    liveGeneration: false,
  });

  try {
    const polled = await pollPrediction(token, createdJson.id!);
    if (polled.url) {
      return { url: polled.url, predictionId: createdJson.id! };
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

async function createReplicatePrediction(
  token: string,
  model: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
  ctx: PreviewFunnelContext,
): Promise<{
  id?: string;
  status?: string;
  error?: string;
  output?: unknown;
  input?: Record<string, unknown>;
}> {
  let lastMessage = "Could not start the preview.";
  // One stable Idempotency-Key for the whole retry loop so a successful create
  // cannot be charged twice if a later retry races after a false failure.
  const replicateIdempotency = idempotencyKey.slice(0, 64);
  for (let attempt = 0; attempt < REPLICATE_CREATE_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const kill = setTimeout(() => controller.abort(), REPLICATE_FETCH_TIMEOUT_MS);
    let created: Response;
    try {
      created = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": replicateIdempotency,
        },
        body: JSON.stringify({ input }),
      });
    } catch (error) {
      clearTimeout(kill);
      if (error instanceof DOMException && error.name === "AbortError") {
        lastMessage = "provider_timeout: Could not start the preview.";
        if (attempt >= REPLICATE_CREATE_ATTEMPTS - 1) throw new Error(lastMessage);
        await sleep(REPLICATE_CREATE_BACKOFF_MS[attempt] || 3000);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(kill);
    }
    const createdJson = (await created.json()) as {
      id?: string;
      status?: string;
      error?: string;
      detail?: string;
      output?: unknown;
      input?: Record<string, unknown>;
    };
    if (created.ok && createdJson.id) {
      previewDiag({
        stage: "provider_create_ok_status",
        funnel: ctx.version,
        model,
        httpStatus: created.status,
        attempt: attempt + 1,
        providerStatus: String(createdJson.status || "unknown").slice(0, 32),
        predictionPrefix: String(createdJson.id).slice(0, 12),
      });
      return createdJson;
    }

    const detail = String(createdJson.error || createdJson.detail || "Could not start the preview.");
    lastMessage = `${created.status}: ${detail}`;
    const throttled =
      created.status === 429 || classifyGenerationError(lastMessage) === "rate_limit";
    previewDiag({
      stage: "provider_create_failed",
      funnel: ctx.version,
      model,
      httpStatus: created.status,
      attempt: attempt + 1,
      errorClass: classifyGenerationError(lastMessage),
      providerStatus: throttled ? "rate_limited" : "create_failed",
      retryAfterHeader: created.headers.get("retry-after") || null,
    });
    if (!throttled || attempt >= REPLICATE_CREATE_ATTEMPTS - 1) {
      throw new Error(lastMessage);
    }
    const waitMs = resolveReplicateRetryWaitMs(created.headers.get("retry-after"), attempt);
    previewDiag({
      stage: "provider_create_retry",
      funnel: ctx.version,
      attempt: attempt + 1,
      waitMs,
      providerStatus: "rate_limited",
    });
    await sleep(waitMs);
  }
  throw new Error(lastMessage);
}

/** Honor Retry-After when present; otherwise exponential backoff + jitter. */
function resolveReplicateRetryWaitMs(retryAfterHeader: string | null, attempt: number): number {
  const retryAfterSec = Number(retryAfterHeader || "");
  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return Math.min(REPLICATE_CREATE_MAX_WAIT_MS, Math.round(retryAfterSec * 1000));
  }
  const base = REPLICATE_CREATE_BACKOFF_MS[attempt] || REPLICATE_CREATE_BACKOFF_MS.at(-1) || 8000;
  // Full-jitter: uniform in [base/2, base]
  const jittered = Math.round(base * (0.5 + Math.random() * 0.5));
  return Math.min(REPLICATE_CREATE_MAX_WAIT_MS, Math.max(250, jittered));
}

/**
 * Identity-preserving edit via OpenAI Images when Replicate create is rate-limited.
 * Still requires the uploaded reference image — never text-only.
 */
async function runOpenAiIdentityEdit(
  imageDataUrl: string,
  prompt: string,
): Promise<{ url: string; predictionId: string }> {
  const key = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!key) {
    throw new Error("OpenAI fallback unavailable.");
  }
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(imageDataUrl);
  if (!match) {
    const err = new Error("Reference image missing for preview generation.") as Error & {
      errorCode?: string;
    };
    err.errorCode = "invalid_image";
    throw err;
  }
  const mime = match[1];
  const b64 = match[2];
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ext = mime.includes("png") ? "png" : "jpg";
  const form = new FormData();
  form.append("model", openAiImageModel());
  form.append("prompt", `${prompt}\n\nEdit the provided photo only. Keep this exact pet.`);
  form.append("image", new Blob([binary], { type: mime }), `pet-reference.${ext}`);
  form.append("quality", "high");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const json = (await res.json()) as {
    created?: number;
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(
      `${res.status}: ${String(json.error?.message || "OpenAI could not start the preview.")}`,
    );
  }
  const predictionId = `openai-fallback:${json.created || Date.now()}`;
  const row = json.data?.[0];
  if (row?.b64_json) {
    return { url: `data:image/png;base64,${row.b64_json}`, predictionId };
  }
  if (row?.url) {
    return { url: row.url, predictionId };
  }
  throw new Error("OpenAI returned no preview image.");
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
  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), REPLICATE_FETCH_TIMEOUT_MS);
  try {
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    return (await poll.json()) as { status?: string; error?: string; output?: unknown };
  } finally {
    clearTimeout(kill);
  }
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
  // OpenAI fallback may already return a data URL — do not re-fetch it.
  if (url.startsWith("data:image/")) return url;
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

async function assertPreviewLimits(
  ctx: PreviewFunnelContext,
  sessionId: string,
  ip: string,
  imageHash: string,
  idempotencyKey: string,
): Promise<{
  ok: boolean;
  message?: string;
  remainingSession?: number;
  remainingIp?: number;
}> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return { ok: true, remainingSession: SESSION_LIMIT, remainingIp: IP_DAY_LIMIT };
  }

  // Replays of an in-flight / succeeded attempt must not be blocked by quota.
  const existing = await getAttemptByKey(ctx, supabaseUrl, serviceKey, idempotencyKey);
  if (
    existing &&
    (existing.status === "pending" ||
      existing.status === "processing" ||
      existing.status === "succeeded" ||
      (existing.status === "failed" && existing.prediction_id))
  ) {
    return { ok: true, remainingSession: SESSION_LIMIT, remainingIp: IP_DAY_LIMIT };
  }

  const since = new Date(Date.now() - 86400000).toISOString();
  const ipHash = await hashIp(ctx, ip);
  const sessionCount = await countAttempts(ctx, supabaseUrl, serviceKey, {
    column: "session_id",
    value: sessionId.slice(0, 64),
    since,
  });
  const ipCount = await countAttempts(ctx, supabaseUrl, serviceKey, {
    column: "ip_hash",
    value: ipHash,
    since,
  });
  const hashCount = await countAttempts(ctx, supabaseUrl, serviceKey, {
    column: "image_hash",
    value: imageHash,
    since,
  });

  if (sessionCount >= SESSION_LIMIT) {
    return { ok: false, message: "This session already used its free previews.", remainingSession: 0 };
  }
  if (ipCount >= IP_DAY_LIMIT) {
    return { ok: false, message: "Too many free previews from this network today.", remainingIp: 0 };
  }
  if (hashCount >= SESSION_LIMIT) {
    return { ok: false, message: "That photo already received a free preview today." };
  }
  return {
    ok: true,
    remainingSession: SESSION_LIMIT - sessionCount,
    remainingIp: IP_DAY_LIMIT - ipCount,
  };
}

async function countAttempts(
  ctx: PreviewFunnelContext,
  supabaseUrl: string,
  serviceKey: string,
  input: { column: string; value: string; since: string },
): Promise<number> {
  if (!input.value) return 0;
  // Only successful live generations consume quota.
  const url =
    `${supabaseUrl}/rest/v1/${ctx.attemptsTable}` +
    `?select=id&${input.column}=eq.${encodeURIComponent(input.value)}` +
    `&live_generation=eq.true&status=eq.succeeded&created_at=gte.${encodeURIComponent(input.since)}`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "count=exact",
    },
  }).catch(() => null);
  if (!res || !res.ok) {
    // Backward compatible if status column not migrated yet.
    const fallback =
      `${supabaseUrl}/rest/v1/${ctx.attemptsTable}` +
      `?select=id&${input.column}=eq.${encodeURIComponent(input.value)}` +
      `&live_generation=eq.true&created_at=gte.${encodeURIComponent(input.since)}`;
    const res2 = await fetch(fallback, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "count=exact",
      },
    }).catch(() => null);
    if (!res2 || !res2.ok) return 0;
    return parseCount(res2);
  }
  return parseCount(res);
}

async function parseCount(res: Response): Promise<number> {
  const range = res.headers.get("content-range");
  if (range && range.includes("/")) {
    const total = Number(range.split("/")[1]);
    if (Number.isFinite(total)) return total;
  }
  const rows = (await res.json().catch(() => [])) as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

async function claimAttempt(
  ctx: PreviewFunnelContext,
  input: {
  idempotencyKey: string;
  sessionId: string;
  ip: string;
  imageHash: string;
  species: string;
}): Promise<AttemptRow | null> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return null;

  const ipHash = await hashIp(ctx, input.ip);
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${ctx.claimRpc}`, {
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
    }),
  }).catch(() => null);

  if (res && res.ok) {
    const row = (await res.json().catch(() => null)) as AttemptRow | null;
    return row;
  }

  // Fallback without RPC: best-effort insert + select.
  const existing = await getAttemptByKey(ctx, supabaseUrl, serviceKey, input.idempotencyKey);
  if (existing) return existing;
  await fetch(`${supabaseUrl}/rest/v1/${ctx.attemptsTable}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      session_id: input.sessionId.slice(0, 64),
      ip_hash: ipHash,
      image_hash: input.imageHash,
      species: input.species,
      scene_key: ctx.sceneKey,
      live_generation: false,
      status: "pending",
      provider: "replicate",
      started_at: new Date().toISOString(),
    }),
  }).catch(() => undefined);
  return await getAttemptByKey(ctx, supabaseUrl, serviceKey, input.idempotencyKey);
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
