import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CHRISTMAS_CLUB_MAX_BODY_BYTES } from "../src/features/christmas/club/config";
import {
  ChristmasClubSignupError,
  clubSignupRowFromValidated,
  isMissingRelationStatus,
  isUniqueViolationStatus,
  validateChristmasClubSignupPayload,
} from "../src/features/christmas/club/signupContract";

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

async function parseJsonBody(req: VercelRequest): Promise<unknown> {
  const body = req.body;
  if (body == null) return {};
  if (typeof body === "string") {
    const bytes = Buffer.byteLength(body, "utf8");
    if (bytes > CHRISTMAS_CLUB_MAX_BODY_BYTES) {
      throw new ChristmasClubSignupError("payload_too_large", 413, "Payload too large");
    }
    try {
      return JSON.parse(body || "{}");
    } catch {
      throw new ChristmasClubSignupError("malformed_json", 400, "Invalid JSON");
    }
  }
  if (typeof body === "object") {
    const encoded = JSON.stringify(body);
    if (Buffer.byteLength(encoded, "utf8") > CHRISTMAS_CLUB_MAX_BODY_BYTES) {
      throw new ChristmasClubSignupError("payload_too_large", 413, "Payload too large");
    }
    return body;
  }
  throw new ChristmasClubSignupError("malformed_json", 400, "Invalid body");
}

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw || !raw.toLowerCase().startsWith("bearer ")) return null;
  const token = raw.slice(7).trim();
  return token || null;
}

async function resolveAuthUser(
  supabaseUrl: string,
  serviceKey: string,
  accessToken: string | null,
): Promise<{ id: string; email: string | null } | null> {
  if (!accessToken) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { id?: string; email?: string | null };
  if (!json.id) return null;
  return { id: json.id, email: json.email ?? null };
}

async function insertViaFunnelLeadsFallback(
  supabaseUrl: string,
  serviceKey: string,
  row: ReturnType<typeof clubSignupRowFromValidated>,
): Promise<{ alreadyJoined: boolean }> {
  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/upsert_funnel_lead`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_email: row.email,
      p_occasion: "christmas",
      p_style_id: row.signup_method,
      p_funnel_slug: `christmas_club_${row.campaign_year}`,
    }),
  });
  if (!rpc.ok) {
    const detail = await rpc.text();
    console.error(
      JSON.stringify({
        source: "christmas-club-signup",
        error_category: "fallback_write_failed",
        status: rpc.status,
        detail: detail.slice(0, 180),
      }),
    );
    throw new Error("Write failed");
  }
  return { alreadyJoined: false };
}

async function insertSignup(
  supabaseUrl: string,
  serviceKey: string,
  row: ReturnType<typeof clubSignupRowFromValidated>,
): Promise<{ alreadyJoined: boolean; storage: "christmas_club_signups" | "funnel_leads" }> {
  const write = await fetch(`${supabaseUrl}/rest/v1/christmas_club_signups`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (write.ok) return { alreadyJoined: false, storage: "christmas_club_signups" };

  const detail = await write.text();
  if (isMissingRelationStatus(write.status, detail)) {
    console.warn(
      JSON.stringify({
        source: "christmas-club-signup",
        error_category: "table_missing_fallback",
        detail: "christmas_club_signups missing; using funnel_leads",
      }),
    );
    const fallback = await insertViaFunnelLeadsFallback(supabaseUrl, serviceKey, row);
    return { ...fallback, storage: "funnel_leads" };
  }

  if (!isUniqueViolationStatus(write.status, detail)) {
    console.error(
      JSON.stringify({
        source: "christmas-club-signup",
        error_category: "write_failed",
        status: write.status,
        detail: detail.slice(0, 180),
      }),
    );
    throw new Error("Write failed");
  }

  const params = new URLSearchParams({
    email: `eq.${row.email}`,
    campaign_year: `eq.${row.campaign_year}`,
  });
  const patch: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
  };
  if (row.user_id) patch.user_id = row.user_id;
  if (row.signup_method === "google") patch.signup_method = "google";

  await fetch(`${supabaseUrl}/rest/v1/christmas_club_signups?${params.toString()}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });

  return { alreadyJoined: true, storage: "christmas_club_signups" };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

  try {
    const json = await parseJsonBody(req);
    const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
      /\/$/,
      "",
    );
    const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !serviceKey) {
      return res.status(503).json({ ok: false, error: "Storage unavailable" });
    }

    const authUser = await resolveAuthUser(supabaseUrl, serviceKey, bearerToken(req));
    const validated = validateChristmasClubSignupPayload(json, {
      authenticatedEmail: authUser?.email ?? null,
    });
    const row = clubSignupRowFromValidated(validated, authUser?.id ?? null);
    const result = await insertSignup(supabaseUrl, serviceKey, row);

    return res.status(200).json({
      ok: true,
      already_joined: result.alreadyJoined,
      campaign_year: validated.campaignYear,
    });
  } catch (err) {
    if (err instanceof ChristmasClubSignupError) {
      return res.status(err.status).json({ ok: false, error: err.message, reason: err.reason });
    }
    console.error(
      JSON.stringify({
        source: "christmas-club-signup",
        error_category: "unhandled",
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
