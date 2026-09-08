import type { VercelRequest, VercelResponse } from "@vercel/node";
import { publicConfigFromUnknown } from "../src/features/christmas-countdown/defaults";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const host = typeof req.headers.host === "string" ? req.headers.host : undefined;
  if (!originAllowed(origin, host)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed" });
  }

  const fallback = publicConfigFromUnknown(null);
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const anon = String(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const key = serviceKey || anon;
  if (!supabaseUrl || !key) {
    return res.status(200).json({ ok: true, source: "defaults", config: fallback });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/public_christmas_countdown_config`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!response.ok) {
      return res.status(200).json({ ok: true, source: "defaults", config: fallback });
    }
    const json = await response.json();
    return res.status(200).json({ ok: true, source: "database", config: publicConfigFromUnknown(json) });
  } catch {
    return res.status(200).json({ ok: true, source: "defaults", config: fallback });
  }
}
