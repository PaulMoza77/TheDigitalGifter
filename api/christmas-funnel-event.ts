import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  CHRISTMAS_FUNNEL_MAX_BODY_BYTES,
  ChristmasFunnelIngestError,
  christmasEventRowFromValidated,
  validateChristmasFunnelIngestPayload,
} from "../src/features/christmas/funnelEventContract";

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

function resolveWriteEnvironment(): "production" | "preview" | "development" {
  const vercel = String(process.env.VERCEL_ENV || "").toLowerCase();
  if (vercel === "production") return "production";
  if (vercel === "preview") return "preview";
  return "development";
}

async function parseJsonBody(req: VercelRequest): Promise<unknown> {
  const body = req.body;
  if (body == null) return {};
  if (typeof body === "string") {
    const bytes = Buffer.byteLength(body, "utf8");
    if (bytes > CHRISTMAS_FUNNEL_MAX_BODY_BYTES) {
      throw new ChristmasFunnelIngestError("payload_too_large", 413, "Payload too large");
    }
    try {
      return JSON.parse(body || "{}");
    } catch {
      throw new ChristmasFunnelIngestError("malformed_json", 400, "Invalid JSON");
    }
  }
  if (typeof body === "object") {
    const encoded = JSON.stringify(body);
    if (Buffer.byteLength(encoded, "utf8") > CHRISTMAS_FUNNEL_MAX_BODY_BYTES) {
      throw new ChristmasFunnelIngestError("payload_too_large", 413, "Payload too large");
    }
    return body;
  }
  throw new ChristmasFunnelIngestError("malformed_json", 400, "Invalid body");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const host = typeof req.headers.host === "string" ? req.headers.host : undefined;
  if (!originAllowed(origin, host)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed" });
  }

  const environment = resolveWriteEnvironment();
  try {
    const json = await parseJsonBody(req);
    const validated = validateChristmasFunnelIngestPayload(json);
    const isTest =
      environment !== "production" ||
      Boolean((json as { is_test_request?: boolean })?.is_test_request);

    const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
      /\/$/,
      "",
    );
    const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !serviceKey) {
      return res.status(503).json({ ok: false, error: "Storage unavailable" });
    }

    const row = christmasEventRowFromValidated(validated, environment, isTest);
    const write = await fetch(`${supabaseUrl}/rest/v1/christmas_funnel_events`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal,resolution=ignore-duplicates",
      },
      body: JSON.stringify(row),
    });

    if (!write.ok && write.status !== 409) {
      const detail = await write.text();
      console.error(
        JSON.stringify({
          source: "christmas-funnel-event",
          error_category: "write_failed",
          status: write.status,
          detail: detail.slice(0, 180),
        }),
      );
      return res.status(502).json({ ok: false, error: "Write failed" });
    }

    return res.status(200).json({
      ok: true,
      duplicate: write.status === 409,
      event_name: validated.eventName,
    });
  } catch (err) {
    if (err instanceof ChristmasFunnelIngestError) {
      return res.status(err.status).json({ ok: false, error: err.message, reason: err.reason });
    }
    console.error(
      JSON.stringify({
        source: "christmas-funnel-event",
        error_category: "unhandled",
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
