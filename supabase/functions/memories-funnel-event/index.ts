import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";

const MEMORIES_EVENT_NAMES = [
  "memories_page_view",
  "memories_hero_cta",
  "memories_upload_started",
  "memories_upload_completed",
  "memories_email_submitted",
  "memories_plan_viewed",
  "memories_plan_selected",
  "memories_checkout_started",
  "memories_checkout_completed",
  "memories_payment_verified",
  "memories_subscription_cancelled",
  "memories_waitlist_joined",
  "memories_checkout_canceled",
] as const;

type MemoriesEventName = (typeof MEMORIES_EVENT_NAMES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.hostname === "www.thedigitalgifter.com" || url.hostname === "thedigitalgifter.com") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function asText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  if (!trimmed || /[<>]/.test(trimmed) || trimmed.includes("@")) return null;
  return trimmed;
}

function parseBody(raw: unknown) {
  if (!raw || typeof raw !== "object") throw new Error("malformed_json");
  const row = raw as Record<string, unknown>;
  const eventName = String(row.event_name || "");
  if (!(MEMORIES_EVENT_NAMES as readonly string[]).includes(eventName)) {
    throw new Error("invalid_event");
  }
  const sessionId = String(row.funnel_session_id || "");
  if (!UUID_RE.test(sessionId)) throw new Error("invalid_session");
  const pathnameRaw = String(row.pathname || "").split("?")[0].slice(0, 64);
  const pathname = pathnameRaw.startsWith("/memories") ? pathnameRaw : null;
  const deviceRaw = row.device_type;
  const deviceType =
    deviceRaw === "mobile" || deviceRaw === "tablet" || deviceRaw === "desktop" ? deviceRaw : null;
  return {
    eventName: eventName as MemoriesEventName,
    funnelSessionId: sessionId,
    eventId: UUID_RE.test(String(row.event_id || "")) ? String(row.event_id) : null,
    idempotencyKey: String(row.idempotency_key || `${sessionId}:${eventName}`).slice(0, 180),
    pathname,
    deviceType,
    amountCents: typeof row.amount_cents === "number" ? Math.round(row.amount_cents) : null,
    product: asText(row.product, 80),
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
    failureCategory: asText(row.failure_category, 80),
    isTest: row.is_test === true,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!originAllowed(req.headers.get("origin"))) return jsonResponse({ error: "Forbidden" }, 403);

  try {
    const validated = parseBody(await readJson(req));
    const service = getServiceClient();
    const { data, error } = await service.rpc("record_memories_funnel_event", {
      p_event_name: validated.eventName,
      p_funnel_session_id: validated.funnelSessionId,
      p_idempotency_key: validated.idempotencyKey,
      p_event_id: validated.eventId,
      p_device_type: validated.deviceType,
      p_pathname: validated.pathname,
      p_amount_cents: validated.amountCents,
      p_product: validated.product,
      p_utm_source: validated.utmSource,
      p_utm_medium: validated.utmMedium,
      p_utm_campaign: validated.utmCampaign,
      p_utm_content: validated.utmContent,
      p_utm_term: validated.utmTerm,
      p_campaign_id: validated.campaignId,
      p_adset_id: validated.adsetId,
      p_ad_id: validated.adId,
      p_has_meta_click: validated.hasFbclid,
      p_referrer_host: validated.referrerHost,
      p_failure_category: validated.failureCategory,
      p_is_test: validated.isTest,
    });
    if (error) throw new Error(`rpc:${error.message}`);
    return jsonResponse({ ok: true, duplicate: Boolean(data?.duplicate) }, 202);
  } catch (err) {
    const message = err instanceof Error ? err.message : "write_failed";
    if (message === "invalid_event" || message === "invalid_session" || message === "malformed_json") {
      return jsonResponse({ error: message }, 400);
    }
    return jsonResponse({ error: "write_failed" }, 500);
  }
});
