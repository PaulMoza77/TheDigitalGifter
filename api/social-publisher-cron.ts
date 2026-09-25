import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { tickSocialPublisher } from "./_lib/social-publisher/invoke";

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

  const response = await tickSocialPublisher();
  if (!response.ok) {
    return res.status(response.status || 500).json({ error: "Tick failed", detail: response.json });
  }
  return res.status(200).json({ ok: true, result: response.json });
}
