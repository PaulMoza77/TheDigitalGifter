import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hashBytes, hashIp, originAllowed } from "../_lib/petV2";

const IDENTITY_LOCK =
  "Edit the reference photo only. Keep the exact same individual animal: identical face shape, eyes, nose, mouth, ears, fur color, fur texture, markings, age, and body proportions. Do not swap breeds. Do not beautify or idealize. Do not generate a different pet.";

const ROYAL_EDIT =
  "Add a royal crown, ornate gold picture frame, and red velvet backdrop with museum lighting.";

const MODEL = "black-forest-labs/flux-kontext-pro";
const MAX_DATA_URL_CHARS = 2_500_000;
const SESSION_LIMIT = 2;
const IP_DAY_LIMIT = 5;

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

  const live = String(process.env.PET_V2_PREVIEW_LIVE || "").toLowerCase() === "true";
  const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
  if (!live || !token) {
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
    const outputUrl = await runKontextPreview(token, imageDataUrl, species);
    const image = await downloadAsDataUrl(outputUrl);
    await recordPreviewAttempt({ sessionId, ip, imageDataUrl, species, live: true });
    return res.status(200).json({
      ok: true,
      mode: "live",
      imageDataUrl: image,
      remainingSession: Math.max(0, (limited.remainingSession ?? SESSION_LIMIT) - 1),
      estimatedSeconds: 20,
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      mode: "live",
      errorCode: "generation_failed",
      error: error instanceof Error ? error.message : "Preview generation failed.",
    });
  }
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
  const createdJson = (await created.json()) as { id?: string; status?: string; error?: string; output?: unknown };
  if (!created.ok || !createdJson.id) {
    throw new Error(String(createdJson.error || "Could not start the preview."));
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
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

async function assertPreviewLimits(sessionId: string, ip: string, imageDataUrl: string): Promise<{
  ok: boolean;
  message?: string;
  remainingSession?: number;
  remainingIp?: number;
}> {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return { ok: true, remainingSession: SESSION_LIMIT, remainingIp: IP_DAY_LIMIT };
  }
  const sessionKey = `pet-v2:session:${sessionId || "anon"}`;
  const ipKey = `pet-v2:ip:${hashIp(ip)}`;
  const hashKey = `pet-v2:img:${hashBytes(Buffer.from(imageDataUrl)).slice(0, 32)}`;
  const sessionOk = await touchLimit(supabaseUrl, serviceKey, sessionKey, SESSION_LIMIT, 60 * 60 * 24);
  const ipOk = await touchLimit(supabaseUrl, serviceKey, ipKey, IP_DAY_LIMIT, 60 * 60 * 24);
  const hashOk = await touchLimit(supabaseUrl, serviceKey, hashKey, SESSION_LIMIT, 60 * 60 * 24);
  if (!sessionOk) {
    return { ok: false, message: "This session already used its free previews.", remainingSession: 0 };
  }
  if (!ipOk) {
    return { ok: false, message: "Too many free previews from this network today.", remainingIp: 0 };
  }
  if (!hashOk) {
    return { ok: false, message: "That photo already received a free preview today." };
  }
  return { ok: true, remainingSession: SESSION_LIMIT, remainingIp: IP_DAY_LIMIT };
}

async function touchLimit(
  supabaseUrl: string,
  serviceKey: string,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/touch_edge_rate_limit`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_key: key, p_limit: limit, p_window_seconds: windowSeconds }),
  });
  if (!res.ok) return true;
  const data = await res.json().catch(() => true);
  return data !== false;
}

async function recordPreviewAttempt(input: {
  sessionId: string;
  ip: string;
  imageDataUrl: string;
  species: string;
  live: boolean;
}): Promise<void> {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
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
      scene_key: "royal-portrait",
      live_generation: input.live,
    }),
  }).catch(() => undefined);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const config = { maxDuration: 60 };
