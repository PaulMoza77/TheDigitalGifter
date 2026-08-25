import { corsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";

const IDENTITY_LOCK =
  "Edit the reference photo only. Keep the exact same individual animal: identical face shape, eyes, nose, mouth, ears, fur color, fur texture, markings, age, and body proportions. Do not swap breeds. Do not beautify or idealize. Do not generate a different pet.";

const ROYAL_EDIT =
  "Add a royal crown, ornate gold picture frame, and red velvet backdrop with museum lighting.";

const MODEL = "black-forest-labs/flux-kontext-pro";
const MAX_DATA_URL_CHARS = 2_500_000;
const SESSION_LIMIT = 2;
const IP_DAY_LIMIT = 5;

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
  // Paid V2 traffic needs a real preview when Replicate is configured.
  // Explicit PET_V2_PREVIEW_LIVE=false remains a kill switch.
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
  const limited = await assertPreviewLimits(sessionId, ip, imageDataUrl);
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

  try {
    const outputUrl = await runKontextPreview(token, imageDataUrl, species);
    const image = await downloadAsDataUrl(outputUrl);
    await recordSuccessfulPreview({ sessionId, ip, imageDataUrl, species });
    return jsonResponse({
      ok: true,
      mode: "live",
      imageDataUrl: image,
      remainingSession: Math.max(0, (limited.remainingSession ?? SESSION_LIMIT) - 1),
      estimatedSeconds: 20,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview generation failed.";
    const errorCode = classifyGenerationError(message);
    return jsonResponse({
      ok: false,
      mode: "live",
      errorCode,
      error: "We couldn't create the preview. Try again.",
      failureCategory: errorCode,
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

async function runKontextPreview(token: string, imageDataUrl: string, species: string): Promise<string> {
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

  for (let i = 0; i < 24; i += 1) {
    await sleep(1500);
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${createdJson.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await poll.json()) as { status?: string; error?: string; output?: unknown };
    if (json.status === "succeeded") {
      const url = replicateOutputUrl(json.output);
      if (!url) throw new Error("The preview finished without an image.");
      return url;
    }
    if (json.status === "failed" || json.status === "canceled") {
      throw new Error(String(json.error || "Preview generation failed."));
    }
  }
  throw new Error("The preview is taking too long. Try again.");
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
  imageDataUrl: string,
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

  const since = new Date(Date.now() - 86400000).toISOString();
  const ipHash = await hashIp(ip);
  const imageHash = (await hashBytes(imageDataUrl)).slice(0, 48);
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
  const url =
    `${supabaseUrl}/rest/v1/pet_v2_preview_attempts` +
    `?select=id&${input.column}=eq.${encodeURIComponent(input.value)}` +
    `&live_generation=eq.true&created_at=gte.${encodeURIComponent(input.since)}`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "count=exact",
    },
  }).catch(() => null);
  if (!res || !res.ok) return 0;
  const range = res.headers.get("content-range");
  if (range && range.includes("/")) {
    const total = Number(range.split("/")[1]);
    if (Number.isFinite(total)) return total;
  }
  const rows = (await res.json().catch(() => [])) as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

async function recordSuccessfulPreview(input: {
  sessionId: string;
  ip: string;
  imageDataUrl: string;
  species: string;
}): Promise<void> {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return;

  const ipHash = await hashIp(input.ip);
  const imageHash = (await hashBytes(input.imageDataUrl)).slice(0, 48);

  // Consume quota only after Replicate accepted and returned an image.
  await Promise.all([
    touchLimit(supabaseUrl, serviceKey, `pet-v2:session:${input.sessionId || "anon"}`, SESSION_LIMIT),
    touchLimit(supabaseUrl, serviceKey, `pet-v2:ip:${ipHash}`, IP_DAY_LIMIT),
    touchLimit(supabaseUrl, serviceKey, `pet-v2:img:${imageHash.slice(0, 32)}`, SESSION_LIMIT),
  ]);

  await fetch(`${supabaseUrl}/rest/v1/pet_v2_preview_attempts`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      session_id: input.sessionId.slice(0, 64),
      ip_hash: ipHash,
      image_hash: imageHash,
      species: input.species,
      scene_key: "royal-portrait",
      live_generation: true,
    }),
  }).catch(() => undefined);
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
