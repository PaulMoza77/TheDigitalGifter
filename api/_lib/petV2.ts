import { createHash } from "node:crypto";
import { originAllowed, logFunnelWriteFailure, resolveWriteEnvironment } from "./writePetFunnelEvent";

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

export type PetV2EventName = (typeof PET_V2_EVENT_NAMES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const V2_PATHS = new Set(["/pet/dog-v2", "/pet/cat-v2", "/pet/other-v2", "/pet-v2"]);

export function isV2EventName(value: string): value is PetV2EventName {
  return (PET_V2_EVENT_NAMES as readonly string[]).includes(value);
}

export function parseV2EventBody(raw: unknown): {
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
} {
  if (!raw || typeof raw !== "object") throw new Error("malformed_json");
  const row = raw as Record<string, unknown>;
  const eventName = String(row.event_name || "");
  if (!isV2EventName(eventName)) throw new Error("invalid_event");
  const sessionId = String(row.funnel_session_id || "");
  if (!UUID_RE.test(sessionId)) throw new Error("invalid_session");
  const pathnameRaw = String(row.pathname || "").split("?")[0].slice(0, 64);
  const pathname =
    V2_PATHS.has(pathnameRaw) || pathnameRaw.startsWith("/pet-v2/") ? pathnameRaw : null;
  const species = row.species === "dog" || row.species === "cat" || row.species === "other" ? row.species : null;
  const deviceRaw = row.device_type;
  const deviceType =
    deviceRaw === "mobile" || deviceRaw === "tablet" || deviceRaw === "desktop" ? deviceRaw : null;
  return {
    eventName,
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
  };
}

function asText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  if (!trimmed || /[<>]/.test(trimmed) || trimmed.includes("@")) return null;
  return trimmed;
}

export async function writePetV2FunnelEvent(raw: unknown): Promise<{ ok: true; duplicate: boolean }> {
  const validated = parseV2EventBody(raw);
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("missing_supabase_config");
  }
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
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`rpc_${response.status}:${text.slice(0, 120)}`);
  }
  const id = await response.json().catch(() => null);
  return { ok: true, duplicate: id == null };
}

export { originAllowed };

export function hashBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`pet-v2:${ip}`).digest("hex").slice(0, 32);
}

export async function persistV2WriteFailure(input: {
  eventName: string;
  category: string;
}): Promise<void> {
  await logFunnelWriteFailure({
    eventName: input.eventName,
    category: input.category,
    environment: resolveWriteEnvironment(),
    funnelDataset: "v2",
  });
}
