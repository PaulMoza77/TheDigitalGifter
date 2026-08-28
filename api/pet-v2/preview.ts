import { createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Legacy Vercel preview endpoint.
 * Production V2 clients call the Supabase edge function `pet-v2-preview`.
 * This handler stays self-contained so Vercel no longer crashes on import.
 */

const IDENTITY_LOCK =
  "Use the uploaded pet photo as the authoritative identity reference. Create the same individual pet in the requested scene. Preserve its exact species, breed appearance, coat color and markings, facial structure, muzzle length and width, ear shape and size, eye placement and color, fur length and texture, body proportions, and distinctive traits. Change only the environment, clothing/accessories, and pose needed for the scene. The final image must be immediately recognizable to the owner as the same pet. Do not swap breeds. Do not replace the animal with a generic dog or cat.";

const F1_DRIVER_EDIT =
  "Create a photoreal, vibrant, cinematic transformation of the uploaded pet as a Formula 1 style racing driver. Change only the scene, styling, props, and lighting — never the pet’s face, fur, breed, or body identity. Place the SAME pet alone in a realistic open-wheel race car cockpit on a bright sunlit racetrack. The pet's real head, face, and front paws must stay clearly visible. Outfit may be racing-inspired but must not copy real commercial logos or team names. Absolutely no human driver behind the pet. No logos, watermarks, or second animals.";

const MODEL = "black-forest-labs/flux-kontext-pro";
const MAX_DATA_URL_CHARS = 2_500_000;
const SESSION_LIMIT = 2;
const IP_DAY_LIMIT = 5;

function originAllowed(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.hostname.endsWith(".vercel.app")) return true;
    if (url.hostname === "www.thedigitalgifter.com" || url.hostname === "thedigitalgifter.com") {
      return true;
    }
    if (host && url.host === host) return true;
    return false;
  } catch {
    return false;
  }
}

function hashBytes(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashIp(ip: string): string {
  return createHash("sha256").update(`pet-v2:${ip}`).digest("hex").slice(0, 32);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const origin = String(req.headers.origin || "");
  const host = String(req.headers.host || "");
  if (origin && !originAllowed(origin, host)) {
    return res.status(403).json({ ok: false, errorCode: "invalid_photo", error: "Forbidden" });
  }

  const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const imageDataUrl = String(body.imageDataUrl || "");
  const sessionId = String(body.session_id || "").slice(0, 64);
  const species = body.species === "cat" || body.species === "other" ? body.species : "dog";
  if (!imageDataUrl.startsWith("data:image/") || imageDataUrl.length > MAX_DATA_URL_CHARS) {
    return res.status(400).json({
      ok: false,
      mode: "mock",
      errorCode: "invalid_photo",
      error: "That photo could not be used. Try a smaller JPEG, PNG, or WebP.",
    });
  }
  if (/image\/heic|image\/heif/i.test(imageDataUrl)) {
    return res.status(400).json({
      ok: false,
      mode: "mock",
      errorCode: "heic_unsupported",
      error:
        "iPhone HEIC photos aren’t supported yet. Set Camera Formats to Most Compatible, or export as JPEG.",
    });
  }

  const liveKill = String(process.env.PET_V2_PREVIEW_LIVE || "").toLowerCase() === "false";
  const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
  if (liveKill || !token) {
    return res.status(200).json({
      ok: false,
      mode: "mock",
      errorCode: "live_disabled",
      error: "Live free-preview generation is off for this environment.",
      remainingSession: SESSION_LIMIT,
    });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown")
    .split(",")[0]
    .trim();
  const limited = await assertPreviewLimits(sessionId, ip, imageDataUrl);
  if (!limited.ok) {
    return res.status(429).json({
      ok: false,
      mode: "mock",
      errorCode: "rate_limited",
      error: limited.message,
      remainingSession: limited.remainingSession,
      remainingIp: limited.remainingIp,
    });
  }

  try {
    const clientKey = String(body.idempotency_key || body.preview_attempt_id || "").trim().slice(0, 180);
    const outputUrl = await runKontextPreview(token, imageDataUrl, species, clientKey);
    const image = await downloadAsDataUrl(outputUrl);
    await recordSuccessfulPreview({ sessionId, ip, imageDataUrl, species });
    return res.status(200).json({
      ok: true,
      mode: "live",
      imageDataUrl: image,
      remainingSession: Math.max(0, (limited.remainingSession ?? SESSION_LIMIT) - 1),
      estimatedSeconds: 20,
      preview_attempt_id: clientKey || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview generation failed.";
    return res.status(200).json({
      ok: false,
      mode: "live",
      errorCode: "generation_failed",
      failureCategory: /401|403|unauthorized/i.test(message) ? "provider_auth" : "provider_error",
      error: "We couldn't create the preview. Try again.",
    });
  }
}

async function runKontextPreview(
  token: string,
  imageDataUrl: string,
  species: string,
  idempotencyKey = "",
): Promise<string> {
  const prompt = [
    IDENTITY_LOCK,
    "Change only background, clothing, props, and lighting. Never replace the pet.",
    F1_DRIVER_EDIT,
    `Subject is a ${species === "other" ? "pet" : species}. Match the uploaded pet's exact appearance from the reference photo.`,
    "Photoreal. Single pet only. No logos, trademarks, team names, or copyrighted characters. No text overlays. No watermarks. No extra animals. No humans in frame.",
  ].join(" ");

  if (!imageDataUrl.startsWith("data:image/")) {
    throw new Error("Reference image missing for preview generation.");
  }

  const created = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 64) } : {}),
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
  const createdJson = (await created.json()) as { id?: string; error?: string; output?: unknown };
  if (!created.ok || !createdJson.id) {
    throw new Error(`${created.status}: ${String(createdJson.error || "Could not start the preview.")}`);
  }

  for (let i = 0; i < 45; i += 1) {
    await sleep(2000);
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
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not download the preview.");
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
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
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return { ok: true, remainingSession: SESSION_LIMIT, remainingIp: IP_DAY_LIMIT };
  }
  const since = new Date(Date.now() - 86400000).toISOString();
  const ipHash = hashIp(ip);
  const imageHash = hashBytes(Buffer.from(imageDataUrl)).slice(0, 48);
  const sessionCount = await countAttempts(supabaseUrl, serviceKey, "session_id", sessionId, since);
  const ipCount = await countAttempts(supabaseUrl, serviceKey, "ip_hash", ipHash, since);
  const hashCount = await countAttempts(supabaseUrl, serviceKey, "image_hash", imageHash, since);
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
  column: string,
  value: string,
  since: string,
): Promise<number> {
  if (!value) return 0;
  const url =
    `${supabaseUrl}/rest/v1/pet_v2_preview_attempts?select=id` +
    `&${column}=eq.${encodeURIComponent(value)}` +
    `&live_generation=eq.true&created_at=gte.${encodeURIComponent(since)}`;
  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "count=exact",
    },
  }).catch(() => null);
  if (!response || !response.ok) return 0;
  const range = response.headers.get("content-range");
  if (range?.includes("/")) {
    const total = Number(range.split("/")[1]);
    if (Number.isFinite(total)) return total;
  }
  const rows = (await response.json().catch(() => [])) as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

async function recordSuccessfulPreview(input: {
  sessionId: string;
  ip: string;
  imageDataUrl: string;
  species: string;
}): Promise<void> {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) return;
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
      ip_hash: hashIp(input.ip),
      image_hash: hashBytes(Buffer.from(input.imageDataUrl)).slice(0, 48),
      species: input.species,
      scene_key: "formula-racer",
      live_generation: true,
    }),
  }).catch(() => undefined);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const config = { maxDuration: 60 };
