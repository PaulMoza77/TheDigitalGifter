import { corsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";

const IDENTITY_LOCK =
  "Edit the reference photo only. Keep the exact same individual animal: identical face shape, eyes, nose, mouth, ears, fur color, fur texture, markings, age, and body proportions. Do not swap breeds. Do not beautify or idealize. Do not generate a different pet.";

const ROYAL_EDIT =
  "Add a royal crown, ornate gold picture frame, and red velvet backdrop with museum lighting.";

const MODEL = "black-forest-labs/flux-kontext-pro";
const MAX_DATA_URL_CHARS = 2_500_000;
const SESSION_LIMIT = 2;
const IP_DAY_LIMIT = 5;
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ITERATIONS = 24;

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
  const species = body.species === "cat" || body.species === "other" ? body.species : "dog";
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
        error:
          "iPhone HEIC photos aren’t supported yet. Set Camera Formats to Most Compatible, or export as JPEG.",
      },
      400,
    );
  }

  const token = String(Deno.env.get("REPLICATE_API_TOKEN") || "").trim();
  const liveKill = String(Deno.env.get("PET_V2_PREVIEW_LIVE") || "").toLowerCase() === "false";
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

  const limited = await assertPreviewLimits(sessionId, ip, imageHash, idempotencyKey);
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

  let claim = await claimAttempt({
    idempotencyKey,
    sessionId,
    ip,
    imageHash,
    species,
  });

  if (claim) {
    const resumed = await resumeExistingAttempt(token, claim, idempotencyKey);
    if (resumed) {
      if (resumed.ok && resumed.imageDataUrl) {
        return jsonResponse({
          ok: true,
          mode: "live",
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

  // Only create when this attempt has no active/succeeded provider prediction.
  if (
    claim?.prediction_id &&
    (claim.status === "pending" || claim.status === "processing" || claim.status === "succeeded")
  ) {
    return jsonResponse({
      ok: false,
      mode: "live",
      errorCode: "generation_failed",
      failureCategory: "server_error",
      error: "We couldn't create the preview. Try again.",
      preview_attempt_id: idempotencyKey,
    });
  }

  try {
    const outputUrl = await runKontextPreview(token, imageDataUrl, species, idempotencyKey);
    const image = await downloadAsDataUrl(outputUrl.url);
    const marked = await markAttempt(idempotencyKey, {
      status: "succeeded",
      predictionId: outputUrl.predictionId,
      liveGeneration: true,
    });
    if (!marked) {
      await insertLegacySuccessfulAttempt({
        sessionId,
        ip,
        imageHash,
        species,
        idempotencyKey,
        predictionId: outputUrl.predictionId,
      });
    }
    await recordSuccessfulQuota({ sessionId, ip, imageHash });
    return jsonResponse({
      ok: true,
      mode: "live",
      imageDataUrl: image,
      remainingSession: Math.max(0, (limited.remainingSession ?? SESSION_LIMIT) - 1),
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
      await markAttempt(idempotencyKey, {
        status: "failed",
        predictionId: predictionId || undefined,
        liveGeneration: false,
        lastErrorCategory: errorCode,
      });
    }
    return jsonResponse({
      ok: false,
      mode: "live",
      errorCode,
      error: "We couldn't create the preview. Try again.",
      failureCategory: errorCode,
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
          await markAttempt(idempotencyKey, {
            status: "succeeded",
            predictionId,
            liveGeneration: true,
          });
        }
        return { ok: true, imageDataUrl: image };
      }
    } catch {
      /* fall through to allow recovery only if output vanished */
    }
    return {
      ok: false,
      blockCreate: true,
      errorCode: "generation_failed",
      failureCategory: "provider_error",
    };
  }

  if ((status === "pending" || status === "processing") && predictionId) {
    try {
      const polled = await pollPrediction(token, predictionId);
      if (polled.url) {
        const image = await downloadAsDataUrl(polled.url);
        await markAttempt(idempotencyKey, {
          status: "succeeded",
          predictionId,
          liveGeneration: true,
        });
        await recordSuccessfulQuotaFromClaim(claim);
        return { ok: true, imageDataUrl: image };
      }
      await markAttempt(idempotencyKey, {
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
          await markAttempt(idempotencyKey, {
            status: "succeeded",
            predictionId,
            liveGeneration: true,
          });
          await recordSuccessfulQuotaFromClaim(claim);
          return { ok: true, imageDataUrl: image };
        }
      }
      if (existing.status === "starting" || existing.status === "processing") {
        const polled = await pollPrediction(token, predictionId);
        if (polled.url) {
          const image = await downloadAsDataUrl(polled.url);
          await markAttempt(idempotencyKey, {
            status: "succeeded",
            predictionId,
            liveGeneration: true,
          });
          await recordSuccessfulQuotaFromClaim(claim);
          return { ok: true, imageDataUrl: image };
        }
        if (polled.errorCode === "timeout") {
          await markAttempt(idempotencyKey, {
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
      await markAttempt(idempotencyKey, {
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
  token: string,
  imageDataUrl: string,
  species: string,
  idempotencyKey: string,
): Promise<{ url: string; predictionId: string }> {
  const prompt = [
    IDENTITY_LOCK,
    "Change only background, clothing, props, and lighting. Never replace the pet.",
    ROYAL_EDIT,
    `Subject is a ${species === "other" ? "pet" : species}.`,
    "Photoreal. Single pet only. No logos, trademarks, or copyrighted characters.",
  ].join(" ");

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

  await markAttempt(idempotencyKey, {
    status: "processing",
    predictionId: createdJson.id,
    liveGeneration: false,
  });

  try {
    const polled = await pollPrediction(token, createdJson.id);
    if (polled.url) {
      return { url: polled.url, predictionId: createdJson.id };
    }
    // Keep processing on wait-timeout so retry resumes the same prediction.
    if (polled.errorCode === "timeout") {
      await markAttempt(idempotencyKey, {
        status: "processing",
        predictionId: createdJson.id,
        liveGeneration: false,
      });
    } else {
      await markAttempt(idempotencyKey, {
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

async function assertPreviewLimits(
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
  const existing = await getAttemptByKey(supabaseUrl, serviceKey, idempotencyKey);
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
  const ipHash = await hashIp(ip);
  const sessionCount = await countAttempts(supabaseUrl, serviceKey, {
    column: "session_id",
    value: sessionId.slice(0, 64),
    since,
  });
  const ipCount = await countAttempts(supabaseUrl, serviceKey, {
    column: "ip_hash",
    value: ipHash,
    since,
  });
  const hashCount = await countAttempts(supabaseUrl, serviceKey, {
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
  supabaseUrl: string,
  serviceKey: string,
  input: { column: string; value: string; since: string },
): Promise<number> {
  if (!input.value) return 0;
  // Only successful live generations consume quota.
  const url =
    `${supabaseUrl}/rest/v1/pet_v2_preview_attempts` +
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
      `${supabaseUrl}/rest/v1/pet_v2_preview_attempts` +
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

async function claimAttempt(input: {
  idempotencyKey: string;
  sessionId: string;
  ip: string;
  imageHash: string;
  species: string;
}): Promise<AttemptRow | null> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return null;

  const ipHash = await hashIp(input.ip);
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_pet_v2_preview_attempt`, {
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
      p_scene_key: "formula-racer",
    }),
  }).catch(() => null);

  if (res && res.ok) {
    const row = (await res.json().catch(() => null)) as AttemptRow | null;
    return row;
  }

  // Fallback without RPC: best-effort insert + select.
  const existing = await getAttemptByKey(supabaseUrl, serviceKey, input.idempotencyKey);
  if (existing) return existing;
  await fetch(`${supabaseUrl}/rest/v1/pet_v2_preview_attempts`, {
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
      scene_key: "formula-racer",
      live_generation: false,
      status: "pending",
      provider: "replicate",
      started_at: new Date().toISOString(),
    }),
  }).catch(() => undefined);
  return await getAttemptByKey(supabaseUrl, serviceKey, input.idempotencyKey);
}

async function getAttemptByKey(
  supabaseUrl: string,
  serviceKey: string,
  idempotencyKey: string,
): Promise<AttemptRow | null> {
  const url =
    `${supabaseUrl}/rest/v1/pet_v2_preview_attempts` +
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

  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/update_pet_v2_preview_attempt`, {
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
    `${supabaseUrl}/rest/v1/pet_v2_preview_attempts?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`,
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

async function insertLegacySuccessfulAttempt(input: {
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
  const ipHash = await hashIp(input.ip);
  const payload: Record<string, unknown> = {
    session_id: input.sessionId.slice(0, 64),
    ip_hash: ipHash,
    image_hash: input.imageHash,
    species: input.species,
    scene_key: "formula-racer",
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
  const first = await fetch(`${supabaseUrl}/rest/v1/pet_v2_preview_attempts`, {
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
  await fetch(`${supabaseUrl}/rest/v1/pet_v2_preview_attempts`, {
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

async function recordSuccessfulQuota(input: {
  sessionId: string;
  ip: string;
  imageHash: string;
}): Promise<void> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return;
  const ipHash = await hashIp(input.ip);
  await Promise.all([
    touchLimit(supabaseUrl, serviceKey, `pet-v2:session:${input.sessionId || "anon"}`, SESSION_LIMIT),
    touchLimit(supabaseUrl, serviceKey, `pet-v2:ip:${ipHash}`, IP_DAY_LIMIT),
    touchLimit(supabaseUrl, serviceKey, `pet-v2:img:${input.imageHash.slice(0, 32)}`, SESSION_LIMIT),
  ]);
}

async function recordSuccessfulQuotaFromClaim(claim: AttemptRow): Promise<void> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return;
  const sessionId = String((claim as { session_id?: string }).session_id || "");
  const ipHash = String((claim as { ip_hash?: string }).ip_hash || "");
  const imageHash = String((claim as { image_hash?: string }).image_hash || "");
  await Promise.all([
    touchLimit(supabaseUrl, serviceKey, `pet-v2:session:${sessionId || "anon"}`, SESSION_LIMIT),
    ipHash ? touchLimit(supabaseUrl, serviceKey, `pet-v2:ip:${ipHash}`, IP_DAY_LIMIT) : Promise.resolve(),
    imageHash
      ? touchLimit(supabaseUrl, serviceKey, `pet-v2:img:${imageHash.slice(0, 32)}`, SESSION_LIMIT)
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

async function hashIp(ip: string): Promise<string> {
  return (await hashBytes(`pet-v2:${ip}`)).slice(0, 32);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void corsHeaders;
