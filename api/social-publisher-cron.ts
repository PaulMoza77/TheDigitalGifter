import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";

/**
 * Minute worker shim for the social publisher.
 * Protect with SOCIAL_PUBLISHER_CRON_SECRET (or CRON_SECRET).
 * Never expose provider tokens to the browser.
 */
export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = String(
    process.env.SOCIAL_PUBLISHER_CRON_SECRET || process.env.CRON_SECRET || process.env.PET_ANALYTICS_CRON_SECRET || "",
  ).trim();
  const provided = String(
    req.headers["x-cron-secret"] ||
      req.headers["x-social-publisher-cron-secret"] ||
      req.headers["authorization"]?.toString().replace(/^Bearer\s+/i, "") ||
      req.query.secret ||
      "",
  ).trim();

  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" });
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/social-publisher`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify({ action: "tick" }),
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }

  if (!response.ok) {
    return res.status(response.status).json({ error: "Tick failed", detail: json });
  }
  return res.status(200).json({ ok: true, result: json });
}
