import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Origin cron shim for Santa retention.
 * Protect with CHRISTMAS_SANTA_CRON_SECRET (or CRON_SECRET).
 * Invokes Edge christmas-santa-retention — no mock data, service-role only.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = String(
    process.env.CHRISTMAS_SANTA_CRON_SECRET ||
      process.env.PET_ANALYTICS_CRON_SECRET ||
      process.env.CRON_SECRET ||
      "",
  ).trim();
  const provided = String(
    req.headers["x-cron-secret"] ||
      req.headers["x-christmas-santa-cron-secret"] ||
      req.headers["authorization"]?.toString().replace(/^Bearer\s+/i, "") ||
      req.query.secret ||
      "",
  ).trim();

  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" });
  }

  const dryRun = String(req.query.dry_run || "") === "1" || String(req.query.dry_run || "") === "true";
  const response = await fetch(`${supabaseUrl}/functions/v1/christmas-santa-retention`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify({ action: "sweep", dry_run: dryRun }),
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }

  if (!response.ok) {
    return res.status(response.status).json({ error: "Retention sweep failed", detail: json });
  }
  return res.status(200).json({ ok: true, result: json });
}
