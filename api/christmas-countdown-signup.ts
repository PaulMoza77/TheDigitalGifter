import type { VercelRequest, VercelResponse } from "@vercel/node";

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

function asText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  if (!trimmed || /[<>]/.test(trimmed)) return null;
  return trimmed;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
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

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ ok: false, error: "Signup unavailable" });
  }

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const email = asText(body.email, 254)?.toLowerCase() || "";
  const method = asText(body.signup_method, 16)?.toLowerCase() || "";
  if (method !== "email" && method !== "google") {
    return res.status(400).json({ ok: false, error: "Invalid signup method" });
  }
  if (method === "email" && !isEmail(email)) {
    return res.status(400).json({ ok: false, error: "Enter a valid email" });
  }

  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const headers: Record<string, string> = {
    apikey: serviceKey,
    Authorization: authHeader.startsWith("Bearer ") ? authHeader : `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/register_christmas_countdown_signup`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_email: email,
        p_signup_method: method,
        p_user_id: asText(body.user_id, 36),
        p_source: asText(body.source, 120),
        p_medium: asText(body.medium, 120),
        p_campaign: asText(body.campaign, 120),
        p_utm_content: asText(body.utm_content, 120),
        p_utm_term: asText(body.utm_term, 120),
        p_referrer: asText(body.referrer, 120),
        p_landing_page: asText(body.landing_page, 120),
        p_funnel_session_id: asText(body.funnel_session_id, 36),
        p_marketing_opt_in: body.marketing_opt_in === true,
        p_campaign_year: Number(body.campaign_year) || 2026,
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(400).json({ ok: false, error: "Signup failed" });
    }
    return res.status(200).json({ ok: true, ...(json && typeof json === "object" ? json : {}) });
  } catch {
    return res.status(500).json({ ok: false, error: "Signup failed" });
  }
}
