import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clientIpFromHeaders,
  countryCodeFromHeaders,
  resolveClientIpHostname,
  resolveFunnelIsTestSync,
} from "./petFunnelTrafficExclude";

/** V3 ingest. Traffic helpers live in ./petFunnelTrafficExclude (not ./_lib) to avoid prior Vercel module-load crashes. */

const PET_V3_EVENT_NAMES = [
  "v3_landing_view",
  "v3_upload_started",
  "v3_upload_completed",
  "v3_upload_failed",
  "v3_preview_generation_started",
  "v3_preview_generation_completed",
  "v3_preview_generation_failed",
  "v3_preview_viewed",
  "v3_preview_regenerated",
  "v3_offer_viewed",
  "v3_unlock_clicked",
  "v3_checkout_viewed",
  "v3_checkout_session_created",
  "v3_begin_checkout",
  "v3_purchase",
] as const;

type PetV3EventName = (typeof PET_V3_EVENT_NAMES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const V3_PATHS = new Set(["/pet/cat-v3"]);

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

async function resolveAuthoritativeV3IsTest(input: {
  environment: "production" | "preview" | "development";
  funnelSessionId: string;
  clientIp?: string;
  countryCode?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
}): Promise<{
  isTest: boolean;
  clientIp: string | null;
  clientIpHostname: string | null;
  countryCode: string | null;
}> {
  const clientIp = String(input.clientIp || "").trim() || null;
  const countryCode = input.countryCode ? String(input.countryCode).trim().toUpperCase() || null : null;
  let clientIpHostname: string | null = null;
  if (input.environment !== "production") {
    return { isTest: true, clientIp, clientIpHostname: null, countryCode };
  }
  if (clientIp) {
    clientIpHostname = await resolveClientIpHostname(clientIp);
  }

  const marked = resolveFunnelIsTestSync({
    environment: input.environment,
    clientIp: clientIp || undefined,
    clientIpHostname,
    countryCode,
    utmSource: input.utmSource,
    utmCampaign: input.utmCampaign,
  });
  if (marked) {
    return { isTest: true, clientIp, clientIpHostname, countryCode };
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey || !UUID_RE.test(input.funnelSessionId)) {
    return { isTest: false, clientIp, clientIpHostname, countryCode };
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/pet_v3_internal_test_session_status`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_funnel_session_id: input.funnelSessionId }),
    });
    if (response.ok) {
      const payload = (await response.json()) as { authorized?: boolean };
      if (payload.authorized) {
        return { isTest: true, clientIp, clientIpHostname, countryCode };
      }
    }
  } catch {
    /* fall through — never trust client hints */
  }

  return { isTest: false, clientIp, clientIpHostname, countryCode };
}

function asText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  if (!trimmed || /[<>]/.test(trimmed) || trimmed.includes("@")) return null;
  return trimmed;
}

function parseV3EventBody(raw: unknown): {
  eventName: PetV3EventName;
  funnelSessionId: string;
  eventId: string;
  idempotencyKey: string;
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
  funnelVersion: string;
  creativeId: string | null;
  fbc: string | null;
  fbp: string | null;
  displayedPriceCents: number | null;
} {
  if (!raw || typeof raw !== "object") throw new Error("malformed_json");
  const row = raw as Record<string, unknown>;
  const eventName = String(row.event_name || "");
  if (!(PET_V3_EVENT_NAMES as readonly string[]).includes(eventName)) throw new Error("invalid_event");
  const sessionId = String(row.funnel_session_id || "");
  if (!UUID_RE.test(sessionId)) throw new Error("invalid_session");
  const pathnameRaw = String(row.pathname || "").split("?")[0].slice(0, 64);
  const pathname = V3_PATHS.has(pathnameRaw) ? pathnameRaw : null;
  const deviceRaw = row.device_type;
  const deviceType =
    deviceRaw === "mobile" || deviceRaw === "tablet" || deviceRaw === "desktop" ? deviceRaw : null;
  return {
    eventName: eventName as PetV3EventName,
    funnelSessionId: sessionId,
    eventId: UUID_RE.test(String(row.event_id || "")) ? String(row.event_id) : sessionId,
    idempotencyKey: String(row.idempotency_key || `${sessionId}:${eventName}`).slice(0, 180),
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
    funnelVersion: (() => {
      const raw = asText(row.funnel_version, 8)?.toLowerCase();
      return raw === "v3" || raw === "unknown" ? raw : "v3";
    })(),
    creativeId: asText(row.creative_id, 120),
    fbc: asText(row.fbc, 200),
    fbp: asText(row.fbp, 200),
    displayedPriceCents:
      typeof row.displayed_price_cents === "number" && Number.isFinite(row.displayed_price_cents)
        ? Math.round(row.displayed_price_cents)
        : null,
  };
}

async function persistV3WriteFailure(input: { eventName: string; category: string }): Promise<void> {
  const environment = resolveWriteEnvironment();
  console.error(
    JSON.stringify({
      source: "pet-v3-funnel-event",
      funnel_dataset: "v3",
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
        funnel_dataset: "v3",
      }),
    });
  } catch {
    /* never throw from logger */
  }
}

async function ensureV3InternalTestSession(input: {
  supabaseUrl: string;
  serviceKey: string;
  funnelSessionId: string;
  reason: string;
}): Promise<void> {
  try {
    await fetch(`${input.supabaseUrl}/rest/v1/pet_v3_internal_test_sessions`, {
      method: "POST",
      headers: {
        apikey: input.serviceKey,
        Authorization: `Bearer ${input.serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        funnel_session_id: input.funnelSessionId,
        reason: input.reason.slice(0, 200),
        expires_at: null,
        registered_by: "geo_exclude",
      }),
    });
    await fetch(`${input.supabaseUrl}/rest/v1/pet_v3_analytics_session_exclusions`, {
      method: "POST",
      headers: {
        apikey: input.serviceKey,
        Authorization: `Bearer ${input.serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({
        funnel_session_id: input.funnelSessionId,
        reason: input.reason.slice(0, 200),
        excluded_by: "geo_exclude",
        notes: "auto-excluded internal geo/IP/UTM test traffic",
      }),
    });
  } catch {
    /* best-effort — record path still sets p_is_test */
  }
}

async function writePetV3FunnelEvent(
  raw: unknown,
  traffic: {
    clientIp: string | null;
    clientIpHostname: string | null;
    countryCode: string | null;
    isTest: boolean;
  },
): Promise<{ ok: true; duplicate: boolean }> {
  const validated = parseV3EventBody(raw);
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("missing_supabase_config");
  }
  const environment = resolveWriteEnvironment();
  const isTest = traffic.isTest;
  if (isTest && environment === "production") {
    await ensureV3InternalTestSession({
      supabaseUrl,
      serviceKey,
      funnelSessionId: validated.funnelSessionId,
      reason: traffic.countryCode
        ? `internal geo ${traffic.countryCode}`
        : "internal test traffic marker",
    });
  }
  const baseBody = {
    p_event_name: validated.eventName,
    p_funnel_session_id: validated.funnelSessionId,
    p_idempotency_key: validated.idempotencyKey,
    p_species: "cat",
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
    p_funnel_version: validated.funnelVersion,
    p_creative_id: validated.creativeId,
    p_fbc: validated.fbc,
    p_fbp: validated.fbp,
    p_client_ip: traffic.clientIp,
    p_client_ip_hostname: traffic.clientIpHostname,
    p_displayed_price_cents: validated.displayedPriceCents,
  };
  const withCountry = { ...baseBody, p_country_code: traffic.countryCode };
  const post = (body: Record<string, unknown>) =>
    fetch(`${supabaseUrl}/rest/v1/rpc/record_pet_v3_funnel_event`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  let response = await post(withCountry);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 404 || /p_country_code|Could not find/i.test(text)) {
      response = await post(baseBody);
      if (!response.ok) {
        const retryText = await response.text().catch(() => "");
        throw new Error(`rpc_${response.status}:${retryText.slice(0, 120)}`);
      }
    } else {
      throw new Error(`rpc_${response.status}:${text.slice(0, 120)}`);
    }
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
    void persistV3WriteFailure({ eventName: "unknown", category: "origin_denied" });
    return res.status(403).json({ error: "Forbidden" });
  }
  let eventName = "unknown";
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    eventName = String((body as { event_name?: unknown }).event_name || "unknown");
    const failureCategory = String((body as { failure_category?: unknown }).failure_category || "")
      .replace(/[^a-z0-9_]/gi, "")
      .slice(0, 40);
    if (eventName === "v3_preview_generation_failed" && failureCategory) {
      void persistV3WriteFailure({ eventName, category: failureCategory });
    }
    const environment = resolveWriteEnvironment();
    const validatedEarly = parseV3EventBody(req.body);
    const traffic = await resolveAuthoritativeV3IsTest({
      environment,
      funnelSessionId: validatedEarly.funnelSessionId,
      clientIp: clientIpFromHeaders(req.headers),
      countryCode: countryCodeFromHeaders(req.headers),
      utmSource: validatedEarly.utmSource,
      utmCampaign: validatedEarly.utmCampaign,
    });
    const result = await writePetV3FunnelEvent(req.body, traffic);
    return res.status(202).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "write_failed";
    if (message === "invalid_event" || message === "invalid_session" || message === "malformed_json") {
      void persistV3WriteFailure({ eventName, category: message });
      return res.status(400).json({ error: message });
    }
    const category = message.startsWith("rpc_")
      ? "rpc_error"
      : message === "missing_supabase_config"
        ? "missing_supabase_config"
        : "write_failed";
    void persistV3WriteFailure({ eventName, category });
    return res.status(500).json({ error: "write_failed" });
  }
}
