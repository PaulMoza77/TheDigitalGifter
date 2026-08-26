import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Self-contained V2 ingest. Do not import ./_lib here — Vercel production was crashing at module load. */

const PET_V2_EVENT_NAMES = [
  "v2_landing_view",
  "v2_upload_started",
  "v2_upload_completed",
  "v2_upload_failed",
  "v2_preview_generation_started",
  "v2_preview_generation_completed",
  "v2_preview_generation_failed",
  "v2_preview_viewed",
  "v2_preview_regenerated",
  "v2_offer_viewed",
  "v2_unlock_clicked",
  "v2_begin_checkout",
  "v2_purchase",
] as const;

type PetV2EventName = (typeof PET_V2_EVENT_NAMES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const V2_PATHS = new Set(["/pet/dog-v2", "/pet/cat-v2", "/pet/other-v2", "/pet-v2"]);

function originAllowed(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.hostname.endsWith(".vercel.app")) return true;
    if (url.hostname === "www.thedigitalgifter.com" || url.hostname === "thedigitalgifter.com") return true;
    if (host && url.host === host) return true;
    return false;
  } catch {
    return false;
  }
}

function resolveWriteEnvironment(): "production" | "preview" | "development" {
  const vercel = String(process.env.VERCEL_ENV || "").toLowerCase();
  if (vercel === "production") return "production";
  if (vercel === "preview") return "preview";
  return "development";
}

function asText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  if (!trimmed || /[<>]/.test(trimmed) || trimmed.includes("@")) return null;
  return trimmed;
}

/** Keep in sync with src/features/pet-v2/failureCategory.ts (self-contained ingest). */
function normalizeFailureCategory(raw: unknown): string | null {
  const token = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 40);
  if (!token) return null;
  if (token === "rate_limit" || token === "ratelimited" || token === "rate_limited") return "rate_limit";
  if (token === "heic_unsupported" || token === "heic" || token === "heif") return "heic_unsupported";
  if (
    token === "invalid_image" ||
    token === "invalid_photo" ||
    token === "validation" ||
    token === "payload_too_large"
  ) {
    return "validation";
  }
  if (token === "timeout") return "timeout";
  if (
    token === "provider" ||
    token === "provider_error" ||
    token === "provider_auth" ||
    token === "generation_failed"
  ) {
    return "provider";
  }
  if (token === "endpoint_unreachable" || token === "network") return "network";
  if (token === "pre_provider" || token === "live_disabled") return "pre_provider";
  if (
    token === "rate_limit" ||
    token === "validation" ||
    token === "heic_unsupported" ||
    token === "provider" ||
    token === "timeout" ||
    token === "pre_provider" ||
    token === "network" ||
    token === "unknown" ||
    token === "server_error"
  ) {
    return token === "server_error" ? "unknown" : token;
  }
  return "unknown";
}

function parseV2EventBody(raw: unknown): {
  eventName: PetV2EventName;
  funnelSessionId: string;
  eventId: string;
  idempotencyKey: string;
  species: "dog" | "cat" | "other" | null;
  pathname: string | null;
  deviceType: "mobile" | "tablet" | "desktop" | null;
  amountCents: number | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
  hasFbclid: boolean;
  referrerHost: string | null;
  failureCategory: string | null;
} {
  if (!raw || typeof raw !== "object") throw new Error("malformed_json");
  const row = raw as Record<string, unknown>;
  const eventName = String(row.event_name || "");
  if (!(PET_V2_EVENT_NAMES as readonly string[]).includes(eventName)) throw new Error("invalid_event");
  const sessionId = String(row.funnel_session_id || "");
  if (!UUID_RE.test(sessionId)) throw new Error("invalid_session");
  const pathnameRaw = String(row.pathname || "").split("?")[0].slice(0, 64);
  const pathname =
    V2_PATHS.has(pathnameRaw) || pathnameRaw.startsWith("/pet-v2/") ? pathnameRaw : null;
  const species = row.species === "dog" || row.species === "cat" || row.species === "other" ? row.species : null;
  const deviceRaw = row.device_type;
  const deviceType =
    deviceRaw === "mobile" || deviceRaw === "tablet" || deviceRaw === "desktop" ? deviceRaw : null;
  const failureCategory =
    eventName === "v2_preview_generation_failed" ? normalizeFailureCategory(row.failure_category) : null;
  return {
    eventName: eventName as PetV2EventName,
    funnelSessionId: sessionId,
    eventId: UUID_RE.test(String(row.event_id || "")) ? String(row.event_id) : sessionId,
    idempotencyKey: String(row.idempotency_key || `${sessionId}:${eventName}`).slice(0, 180),
    species,
    pathname,
    deviceType,
    amountCents: typeof row.amount_cents === "number" ? Math.round(row.amount_cents) : null,
    utmSource: asText(row.utm_source),
    utmMedium: asText(row.utm_medium),
    utmCampaign: asText(row.utm_campaign),
    utmContent: asText(row.utm_content),
    utmTerm: asText(row.utm_term),
    campaignId: asText(row.campaign_id),
    adsetId: asText(row.adset_id),
    adId: asText(row.ad_id),
    hasFbclid: row.has_meta_click === true || row.has_fbclid === true,
    referrerHost: asText(row.referrer_host, 120),
    failureCategory,
  };
}

async function persistV2WriteFailure(input: { eventName: string; category: string }): Promise<void> {
  const environment = resolveWriteEnvironment();
  console.error(
    JSON.stringify({
      source: "pet-v2-funnel-event",
      funnel_dataset: "v2",
      event_name: input.eventName,
      error_category: input.category,
      environment,
      timestamp: new Date().toISOString(),
    }),
  );
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  ).trim();
  if (!supabaseUrl || !serviceKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/pet_funnel_event_failures`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_name: input.eventName.slice(0, 64),
        error_category: input.category.slice(0, 80),
        environment: environment.slice(0, 32),
        funnel_dataset: "v2",
      }),
    });
  } catch {
    /* never throw from logger */
  }
}

async function writePetV2FunnelEvent(raw: unknown): Promise<{ ok: true; duplicate: boolean }> {
  const validated = parseV2EventBody(raw);
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  ).trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("missing_supabase_config");
  }
  const environment = resolveWriteEnvironment();
  const isTest = environment !== "production";
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/record_pet_v2_funnel_event`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_event_name: validated.eventName,
      p_funnel_session_id: validated.funnelSessionId,
      p_idempotency_key: validated.idempotencyKey,
      p_species: validated.species,
      p_utm_source: validated.utmSource,
      p_utm_medium: validated.utmMedium,
      p_utm_campaign: validated.utmCampaign,
      p_utm_content: validated.utmContent,
      p_utm_term: validated.utmTerm,
      p_campaign_id: validated.campaignId,
      p_adset_id: validated.adsetId,
      p_ad_id: validated.adId,
      p_device_type: validated.deviceType,
      p_pathname: validated.pathname,
      p_amount_cents: validated.amountCents,
      p_has_meta_click: validated.hasFbclid,
      p_referrer_host: validated.referrerHost,
      p_client_event_id: validated.eventId,
      p_is_test: isTest,
      p_environment: environment,
      p_failure_category: validated.failureCategory,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`rpc_${response.status}:${text.slice(0, 120)}`);
  }
  const id = await response.json().catch(() => null);
  return { ok: true, duplicate: id == null };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const origin = String(req.headers.origin || "");
  const host = String(req.headers.host || "");
  if (origin && !originAllowed(origin, host)) {
    void persistV2WriteFailure({ eventName: "unknown", category: "origin_denied" });
    return res.status(403).json({ error: "Forbidden" });
  }
  let eventName = "unknown";
  try {
    // Successfully ingested generation-failure events are product telemetry, not write failures.
    const result = await writePetV2FunnelEvent(req.body);
    return res.status(202).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "write_failed";
    if (req.body && typeof req.body === "object") {
      eventName = String((req.body as { event_name?: unknown }).event_name || "unknown");
    }
    if (message === "invalid_event" || message === "invalid_session" || message === "malformed_json") {
      void persistV2WriteFailure({ eventName, category: message });
      return res.status(400).json({ error: message });
    }
    const category = message.startsWith("rpc_")
      ? "rpc_error"
      : message === "missing_supabase_config"
        ? "missing_supabase_config"
        : "write_failed";
    void persistV2WriteFailure({ eventName, category });
    return res.status(500).json({ error: "write_failed" });
  }
}
