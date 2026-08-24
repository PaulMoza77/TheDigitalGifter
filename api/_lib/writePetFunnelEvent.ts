import {
  FunnelIngestError,
  PET_FUNNEL_MAX_BODY_BYTES,
  validateFunnelIngestPayload,
  type ValidatedFunnelIngest,
} from "./funnelIngestContract";

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
  funnelDataset?: "v1" | "v2";
};

export async function logFunnelWriteFailure(input: FailureLog): Promise<void> {
  const ts = new Date().toISOString();
  console.error(
    JSON.stringify({
      source: "pet-funnel-event",
      funnel_dataset: input.funnelDataset || "v1",
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
        funnel_dataset: input.funnelDataset || "v1",
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
