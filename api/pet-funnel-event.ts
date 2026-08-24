import type { VercelRequest, VercelResponse } from "@vercel/node";

export const PET_FUNNEL_EVENT_PATH = "/api/pet/funnel-event";

export const PET_FUNNEL_ALLOWED_EVENTS = [
  "landing_view",
  "pet_name_submitted",
  "photo_upload_started",
  "photo_upload_completed",
  "pet_details_completed",
  "order_review_viewed",
  "initiate_checkout",
  "purchase",
  "checkout_error",
] as const;

export type PetFunnelAllowedEvent = (typeof PET_FUNNEL_ALLOWED_EVENTS)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PET_FUNNEL_MAX_BODY_BYTES = 4096;

/** Once per funnel session (and species for landing). Dashboard KPIs still unique-session. */
const SESSION_ONCE_EVENTS = new Set<PetFunnelAllowedEvent>([
  "landing_view",
  "pet_name_submitted",
  "photo_upload_started",
  "photo_upload_completed",
  "pet_details_completed",
  "order_review_viewed",
]);

export type FunnelTrafficClass = "meta_paid" | "organic" | "direct" | "other";

export type PetFunnelIngestPayload = {
  event_name: string;
  funnel_session_id: string;
  event_id?: string;
  idempotency_key?: string;
  species?: string | null;
  pathname?: string | null;
  device_type?: string | null;
  amount_cents?: number | null;
  order_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  campaign_id?: string | null;
  adset_id?: string | null;
  ad_id?: string | null;
  has_fbclid?: boolean;
  referrer_host?: string | null;
  is_test_request?: boolean;
};

export type ValidatedFunnelIngest = {
  eventName: PetFunnelAllowedEvent;
  funnelSessionId: string;
  eventId: string;
  idempotencyKey: string;
  species: "dog" | "cat" | "other" | null;
  pathname: string | null;
  deviceType: "mobile" | "tablet" | "desktop" | null;
  amountCents: number | null;
  orderId: string | null;
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
};

export type IngestRejectReason =
  | "invalid_event"
  | "invalid_session"
  | "invalid_uuid"
  | "payload_too_large"
  | "malformed_json"
  | "oversized_field";

export class FunnelIngestError extends Error {
  constructor(
    public readonly reason: IngestRejectReason,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FunnelIngestError";
  }
}

export function isPetFunnelEventName(value: string): value is PetFunnelAllowedEvent {
  return (PET_FUNNEL_ALLOWED_EVENTS as readonly string[]).includes(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function newFunnelUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    const v = char === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function sanitizeFunnelText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  if (!trimmed) return null;
  if (/[<>]/.test(trimmed)) return null;
  if (trimmed.includes("@")) return null;
  if (/^https?:/i.test(trimmed)) return null;
  if (/[\u0000-\u001F]/.test(trimmed)) return null;
  return trimmed;
}

export function sanitizePathname(value: unknown): string | null {
  const raw = sanitizeFunnelText(typeof value === "string" ? value.split("?")[0] : value, 64);
  if (!raw) return null;
  if (raw === "/pet" || raw.startsWith("/pet/")) return raw;
  return null;
}

export function logicalIdempotencyKey(input: {
  sessionId: string;
  eventName: PetFunnelAllowedEvent;
  species?: string | null;
  orderId?: string | null;
}): string {
  if (input.eventName === "landing_view") {
    return `${input.sessionId}:landing_view:${input.species || ""}`;
  }
  if (SESSION_ONCE_EVENTS.has(input.eventName)) {
    return `${input.sessionId}:${input.eventName}`;
  }
  return [input.sessionId, input.eventName, input.species || "", input.orderId || ""].join(":");
}

export function classifyFunnelTraffic(input: {
  utmSource?: string | null;
  campaignId?: string | null;
  hasFbclid?: boolean;
}): FunnelTrafficClass {
  const source = String(input.utmSource || "").trim().toLowerCase();
  const metaSources = new Set(["facebook", "fb", "instagram", "ig", "an", "msg", "meta", "paid_social"]);
  if (input.campaignId || metaSources.has(source) || input.hasFbclid) return "meta_paid";
  if (source === "organic" || source === "seo") return "organic";
  if (source) return "other";
  return "direct";
}

export function adsLikelyMissingUtms(input: { hasFbclid?: boolean; campaignId?: string | null; utmSource?: string | null }): boolean {
  return Boolean(input.hasFbclid) && !input.campaignId && !input.utmSource;
}

export function validateFunnelIngestPayload(
  raw: unknown,
  bodyBytes: number,
): ValidatedFunnelIngest {
  if (bodyBytes > PET_FUNNEL_MAX_BODY_BYTES) {
    throw new FunnelIngestError("payload_too_large", 413, "Payload too large");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new FunnelIngestError("malformed_json", 400, "Invalid payload");
  }
  const row = raw as Record<string, unknown>;
  const eventName = String(row.event_name || "");
  if (!isPetFunnelEventName(eventName)) {
    throw new FunnelIngestError("invalid_event", 400, "Unsupported event");
  }
  const sessionId = row.funnel_session_id || row.funnel_session_id;
  if (!isUuid(sessionId)) {
    throw new FunnelIngestError("invalid_session", 400, "Invalid session");
  }
  const eventIdRaw = row.event_id;
  if (eventIdRaw != null && !isUuid(eventIdRaw)) {
    throw new FunnelIngestError("invalid_uuid", 400, "Invalid event id");
  }
  const orderId = row.order_id;
  if (orderId != null && orderId !== "" && !isUuid(orderId)) {
    throw new FunnelIngestError("invalid_uuid", 400, "Invalid order id");
  }
  const speciesRaw = row.species;
  const species = speciesRaw === "dog" || speciesRaw === "cat" || speciesRaw === "other" ? speciesRaw : null;
  const deviceRaw = row.device_type;
  const deviceType =
    deviceRaw === "mobile" || deviceRaw === "tablet" || deviceRaw === "desktop" ? deviceRaw : null;
  const amount = row.amount_cents;
  const amountCents =
    typeof amount === "number" && Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : null;

  const idempotencyKey =
    sanitizeFunnelText(row.idempotency_key, 180) ||
    logicalIdempotencyKey({
      sessionId,
      eventName,
      species,
      orderId: isUuid(orderId) ? orderId : null,
    });
  if (idempotencyKey.length < 8) {
    throw new FunnelIngestError("invalid_uuid", 400, "Invalid idempotency key");
  }

  return {
    eventName,
    funnelSessionId: sessionId,
    eventId: isUuid(eventIdRaw) ? eventIdRaw : newFunnelUuid(),
    idempotencyKey,
    species,
    pathname: sanitizePathname(row.pathname),
    deviceType,
    amountCents,
    orderId: isUuid(orderId) ? orderId : null,
    utmSource: sanitizeFunnelText(row.utm_source),
    utmMedium: sanitizeFunnelText(row.utm_medium),
    utmCampaign: sanitizeFunnelText(row.utm_campaign),
    utmContent: sanitizeFunnelText(row.utm_content),
    utmTerm: sanitizeFunnelText(row.utm_term),
    campaignId: sanitizeFunnelText(row.campaign_id),
    adsetId: sanitizeFunnelText(row.adset_id),
    adId: sanitizeFunnelText(row.ad_id),
    hasFbclid: row.has_fbclid === true || row.has_meta_click === true,
    referrerHost: sanitizeFunnelText(row.referrer_host, 120),
  };
}

/**
 * Set this ISO timestamp after the fixed tracker is live on production.
 * Null means conversion math is not yet certified for production.
 */
export const PET_FUNNEL_MEASUREMENT_RELIABLE_FROM: string | null = null;

export function firstPartyConversionPct(
  numerator: number | null | undefined,
  firstPartyDenominator: number | null | undefined,
  _metaLpv?: number | null,
): number | null {
  void _metaLpv;
  if (numerator == null || firstPartyDenominator == null) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(firstPartyDenominator) || firstPartyDenominator <= 0) {
    return null;
  }
  return (numerator / firstPartyDenominator) * 100;
}

export function trackingCoverageSignal(firstPartyLandings: number, metaLpv: number | null): {
  ratio: number | null;
  unhealthy: boolean;
} {
  if (metaLpv == null || !Number.isFinite(metaLpv) || metaLpv <= 0) {
    return { ratio: null, unhealthy: false };
  }
  const landings = Number.isFinite(firstPartyLandings) ? Math.max(0, firstPartyLandings) : 0;
  return {
    ratio: landings / metaLpv,
    unhealthy: landings === 0,
  };
}

export type WriteEnvironment = "production" | "preview" | "development";

export function resolveWriteEnvironment(): WriteEnvironment {
  const vercel = String(process.env.VERCEL_ENV || "").toLowerCase();
  if (vercel === "production") return "production";
  if (vercel === "preview") return "preview";
  return "development";
}

export function resolveIsTest(environment: WriteEnvironment, clientFlag: boolean): boolean {
  if (environment !== "production") return true;
  void clientFlag;
  return false;
}

export async function parseJsonBody(req: { headers?: Record<string, unknown>; body?: unknown }): Promise<{
  json: unknown;
  bytes: number;
}> {
  const body = req.body;
  if (body == null) return { json: {}, bytes: 0 };
  if (typeof body === "string") {
    const bytes = Buffer.byteLength(body, "utf8");
    if (bytes > PET_FUNNEL_MAX_BODY_BYTES) {
      throw new FunnelIngestError("payload_too_large", 413, "Payload too large");
    }
    try {
      return { json: JSON.parse(body || "{}"), bytes };
    } catch {
      throw new FunnelIngestError("malformed_json", 400, "Invalid JSON");
    }
  }
  if (typeof body === "object") {
    const encoded = JSON.stringify(body);
    const bytes = Buffer.byteLength(encoded, "utf8");
    if (bytes > PET_FUNNEL_MAX_BODY_BYTES) {
      throw new FunnelIngestError("payload_too_large", 413, "Payload too large");
    }
    return { json: body, bytes };
  }
  throw new FunnelIngestError("malformed_json", 400, "Invalid body");
}

export function originAllowed(origin: string | undefined, host: string | undefined): boolean {
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

type FailureLog = {
  eventName: string;
  category: string;
  environment: string;
};

export async function logFunnelWriteFailure(input: FailureLog): Promise<void> {
  const ts = new Date().toISOString();
  console.error(
    JSON.stringify({
      source: "pet-funnel-event",
      event_name: input.eventName,
      error_category: input.category,
      environment: input.environment,
      timestamp: ts,
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
        environment: input.environment.slice(0, 32),
      }),
    });
  } catch {
    /* never throw from logger */
  }
}

export async function writeValidatedFunnelEvent(
  validated: ValidatedFunnelIngest,
  options: { isTest: boolean; environment: WriteEnvironment },
): Promise<{ duplicate: boolean }> {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("missing_supabase_config");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/record_pet_funnel_event`, {
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
      p_order_id: validated.orderId,
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
      p_is_test: options.isTest,
      p_environment: options.environment,
      p_has_meta_click: validated.hasFbclid,
      p_referrer_host: validated.referrerHost,
      p_client_event_id: validated.eventId,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`rpc_${response.status}:${text.slice(0, 120)}`);
  }
  const id = await response.json().catch(() => null);
  return { duplicate: id == null };
}

export function ingestFromUnknown(
  raw: unknown,
  bytes: number,
): ValidatedFunnelIngest {
  return validateFunnelIngestPayload(raw, bytes);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const environment = resolveWriteEnvironment();
  const origin = String(req.headers.origin || "");
  const host = String(req.headers.host || "");
  if (origin && !originAllowed(origin, host)) {
    void logFunnelWriteFailure({ eventName: "unknown", category: "origin_denied", environment });
    return res.status(403).json({ error: "Forbidden" });
  }

  let eventName = "unknown";
  try {
    const { json, bytes } = await parseJsonBody(req);
    const clientTest = Boolean((json as { is_test_request?: boolean } | null)?.is_test_request);
    const validated = ingestFromUnknown(json, bytes);
    eventName = validated.eventName;
    const isTest = resolveIsTest(environment, clientTest);
    const result = await writeValidatedFunnelEvent(validated, { isTest, environment });
    return res.status(202).json({ ok: true, duplicate: result.duplicate });
  } catch (error) {
    if (error instanceof FunnelIngestError) {
      void logFunnelWriteFailure({
        eventName,
        category: error.reason,
        environment,
      });
      return res.status(error.status).json({ error: error.reason });
    }
    const category = error instanceof Error && error.message.startsWith("rpc_") ? "rpc_error" : "write_failed";
    void logFunnelWriteFailure({ eventName, category, environment });
    return res.status(500).json({ error: "write_failed" });
  }
}
