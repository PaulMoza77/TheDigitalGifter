import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clientIpFromHeaders,
  countryCodeFromHeaders,
  resolveFunnelIsTest,
} from "./petFunnelTrafficExclude";

/** V4 New Sales Campaign ingest — isolated from V1/V2/V3. */

const PET_V4_EVENT_NAMES = [
  "v4_landing_view",
  "v4_scroll_depth",
  "v4_first_interaction",
  "v4_upload_opened",
  "v4_upload_started",
  "v4_upload_completed",
  "v4_upload_failed",
  "v4_upload_abandoned",
  "v4_generation_started",
  "v4_generation_completed",
  "v4_generation_failed",
  "v4_generation_left",
  "v4_teaser_viewed",
  "v4_offer_viewed",
  "v4_cta_clicked",
  "v4_cta_exposed",
  "v4_checkout_clicked",
  "v4_checkout_session_created",
  "v4_checkout_opened",
  "v4_checkout_abandoned",
  "v4_purchase",
] as const;

type PetV4EventName = (typeof PET_V4_EVENT_NAMES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const V4_PATHS = new Set([
  "/pet/dog-v4",
  "/pet/cat-v4",
  "/pet/other-v4",
  "/pet/dog-v2",
  "/pet/cat-v2",
  "/pet/other-v2",
]);

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

function asInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function parseV4EventBody(raw: unknown) {
  if (!raw || typeof raw !== "object") throw new Error("malformed_json");
  const row = raw as Record<string, unknown>;
  const eventName = String(row.event_name || "");
  if (!(PET_V4_EVENT_NAMES as readonly string[]).includes(eventName)) throw new Error("invalid_event");
  const sessionId = String(row.funnel_session_id || "");
  if (!UUID_RE.test(sessionId)) throw new Error("invalid_session");
  const visitorRaw = String(row.visitor_id || "");
  const visitorId = UUID_RE.test(visitorRaw) ? visitorRaw : null;
  const pathnameRaw = String(row.pathname || "").split("?")[0].slice(0, 64);
  const pathname = V4_PATHS.has(pathnameRaw) ? pathnameRaw : null;
  const species = row.species === "dog" || row.species === "cat" || row.species === "other" ? row.species : null;
  const deviceRaw = row.device_type;
  const deviceType =
    deviceRaw === "mobile" || deviceRaw === "tablet" || deviceRaw === "desktop" ? deviceRaw : null;
  const browserFamilyRaw = asText(row.browser_family, 32)?.toLowerCase() ?? null;
  const browserFamily =
    browserFamilyRaw && ["safari", "chrome", "firefox", "edge", "samsung", "other"].includes(browserFamilyRaw)
      ? browserFamilyRaw
      : null;
  const inAppRaw = asText(row.in_app_browser, 32)?.toLowerCase() ?? null;
  const inAppBrowser =
    inAppRaw && ["facebook_iab", "instagram_iab", "other_iab"].includes(inAppRaw) ? inAppRaw : null;
  const scrollBucketRaw = asText(row.scroll_bucket, 32)?.toLowerCase() ?? null;
  const scrollBucket =
    scrollBucketRaw && ["lt25", "p25", "p50", "p75", "p90", "main_cta", "pricing"].includes(scrollBucketRaw)
      ? scrollBucketRaw
      : null;
  const ctaRaw = asText(row.cta_location, 32)?.toLowerCase() ?? null;
  const ctaLocation =
    ctaRaw && ["hero", "upload", "try_generate", "teaser", "offer", "buy", "checkout", "other"].includes(ctaRaw)
      ? ctaRaw
      : null;

  return {
    eventName: eventName as PetV4EventName,
    funnelSessionId: sessionId,
    visitorId,
    eventId: UUID_RE.test(String(row.event_id || "")) ? String(row.event_id) : sessionId,
    idempotencyKey: String(row.idempotency_key || `${sessionId}:${eventName}`).slice(0, 180),
    species,
    pathname,
    deviceType,
    amountCents: asInt(row.amount_cents),
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
    failureCategory: asText(row.failure_category, 40),
    browserFamily,
    inAppBrowser,
    fbc: asText(row.fbc, 200),
    fbp: asText(row.fbp, 200),
    ctaLocation,
    scrollBucket,
    scrollPct: asInt(row.scroll_pct),
    engagedMs: asInt(row.engaged_ms),
    generationDurationMs: asInt(row.generation_duration_ms),
    metaPlacement: asText(row.meta_placement, 80),
  };
}

async function persistV4WriteFailure(input: { eventName: string; category: string }): Promise<void> {
  const environment = resolveWriteEnvironment();
  console.error(
    JSON.stringify({
      source: "pet-v4-funnel-event",
      funnel_dataset: "v4",
      event_name: input.eventName,
      error_category: input.category,
      environment,
      timestamp: new Date().toISOString(),
    }),
  );
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
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
        funnel_dataset: "v4",
      }),
    });
  } catch {
    /* never throw from logger */
  }
}

async function writePetV4FunnelEvent(
  raw: unknown,
  traffic: {
    isTest: boolean;
    clientIp: string | null;
    clientIpHostname: string | null;
    countryCode: string | null;
  },
): Promise<{ ok: true; duplicate: boolean }> {
  const validated = parseV4EventBody(raw);
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) throw new Error("missing_supabase_config");
  const environment = resolveWriteEnvironment();
  const body = {
    p_event_name: validated.eventName,
    p_funnel_session_id: validated.funnelSessionId,
    p_idempotency_key: validated.idempotencyKey,
    p_visitor_id: validated.visitorId,
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
    p_browser_family: validated.browserFamily,
    p_in_app_browser: validated.inAppBrowser,
    p_pathname: validated.pathname,
    p_amount_cents: validated.amountCents,
    p_has_meta_click: validated.hasFbclid,
    p_referrer_host: validated.referrerHost,
    p_client_event_id: validated.eventId,
    p_is_test: traffic.isTest,
    p_environment: environment,
    p_funnel_variant: "v4_sales",
    p_funnel_version: "v4",
    p_fbc: validated.fbc,
    p_fbp: validated.fbp,
    p_failure_category: validated.failureCategory,
    p_cta_location: validated.ctaLocation,
    p_scroll_bucket: validated.scrollBucket,
    p_scroll_pct: validated.scrollPct,
    p_engaged_ms: validated.engagedMs,
    p_generation_duration_ms: validated.generationDurationMs,
    p_meta_placement: validated.metaPlacement,
    p_country_code: traffic.countryCode,
  };
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/record_pet_v4_funnel_event`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`rpc_${response.status}:${text.slice(0, 160)}`);
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
    void persistV4WriteFailure({ eventName: "unknown", category: "origin_denied" });
    return res.status(403).json({ error: "Forbidden" });
  }
  let eventName = "unknown";
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    eventName = String((body as { event_name?: unknown }).event_name || "unknown");
    const environment = resolveWriteEnvironment();
    const early = parseV4EventBody(req.body);
    const traffic = await resolveFunnelIsTest({
      environment,
      clientIp: clientIpFromHeaders(req.headers),
      countryCode: countryCodeFromHeaders(req.headers),
      utmSource: early.utmSource,
      utmCampaign: early.utmCampaign,
    });
    const result = await writePetV4FunnelEvent(req.body, traffic);
    return res.status(202).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "write_failed";
    if (message === "invalid_event" || message === "invalid_session" || message === "malformed_json") {
      void persistV4WriteFailure({ eventName, category: message });
      return res.status(400).json({ error: message });
    }
    const category = message.startsWith("rpc_")
      ? "rpc_error"
      : message === "missing_supabase_config"
        ? "missing_supabase_config"
        : "write_failed";
    void persistV4WriteFailure({ eventName, category });
    return res.status(500).json({ error: "write_failed" });
  }
}
