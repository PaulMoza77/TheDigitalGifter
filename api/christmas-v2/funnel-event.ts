import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Self-contained Christmas V2 ingest. Do not import ./_lib here — match pet-v2 pattern. */

const CHRISTMAS_V2_EVENT_NAMES = [
  "christmas_v2_view",
  "christmas_v2_upload_started",
  "christmas_v2_upload_completed",
  "christmas_v2_upload_failed",
  "christmas_v2_offer_viewed",
  "christmas_v2_checkout_started",
  "christmas_v2_checkout_rendered",
  "christmas_v2_payment_submitted",
  "christmas_v2_checkout_failed",
  "christmas_v2_checkout_canceled",
  "christmas_v2_purchase",
  "christmas_v2_generation_started",
  "christmas_v2_generation_completed",
  "christmas_v2_generation_failed",
  "christmas_v2_results_viewed",
  "christmas_v2_upsell_viewed",
  "christmas_v2_magic_pack_checkout",
  "christmas_v2_magic_pack_purchase",
  "christmas_v2_ultimate_pack_checkout",
  "christmas_v2_ultimate_pack_purchase",
  "christmas_v2_video_generated",
] as const;

type ChristmasV2EventName = (typeof CHRISTMAS_V2_EVENT_NAMES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CHRISTMAS_PATHS = new Set(["/christmas-ai-photos", "/christmas-ai-photos/order"]);

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

function asText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  if (!trimmed || /[<>]/.test(trimmed) || trimmed.includes("@")) return null;
  return trimmed;
}

function parseChristmasEventBody(raw: unknown): {
  eventName: ChristmasV2EventName;
  funnelSessionId: string;
  eventId: string | null;
  idempotencyKey: string;
  pathname: string | null;
  deviceType: "mobile" | "tablet" | "desktop" | null;
  amountCents: number | null;
  product: string | null;
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
  if (!(CHRISTMAS_V2_EVENT_NAMES as readonly string[]).includes(eventName)) {
    throw new Error("invalid_event");
  }
  const sessionId = String(row.funnel_session_id || "");
  if (!UUID_RE.test(sessionId)) throw new Error("invalid_session");
  const pathnameRaw = String(row.pathname || "").split("?")[0].slice(0, 64);
  const pathname =
    CHRISTMAS_PATHS.has(pathnameRaw) || pathnameRaw.startsWith("/christmas-ai-photos")
      ? pathnameRaw
      : null;
  const deviceRaw = row.device_type;
  const deviceType =
    deviceRaw === "mobile" || deviceRaw === "tablet" || deviceRaw === "desktop" ? deviceRaw : null;
  return {
    eventName: eventName as ChristmasV2EventName,
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
  };
}

async function writeChristmasV2FunnelEvent(raw: unknown): Promise<{ ok: true; duplicate: boolean }> {
  const validated = parseChristmasEventBody(raw);
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("missing_supabase_config");
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/record_christmas_v2_funnel_event`, {
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
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`rpc_${response.status}:${text.slice(0, 120)}`);
  }
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    duplicate?: boolean;
  } | null;
  return { ok: true, duplicate: Boolean(payload?.duplicate) };
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
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const result = await writeChristmasV2FunnelEvent(req.body);
    return res.status(202).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "write_failed";
    if (message === "invalid_event" || message === "invalid_session" || message === "malformed_json") {
      return res.status(400).json({ error: message });
    }
    console.error(
      JSON.stringify({
        source: "christmas-v2-funnel-event",
        error: message.slice(0, 200),
        timestamp: new Date().toISOString(),
      }),
    );
    return res.status(500).json({ error: "write_failed" });
  }
}
