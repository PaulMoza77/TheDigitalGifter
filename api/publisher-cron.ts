import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { tickPublisherWorker } from "./_lib/publisher/service";

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const cronSecret = String(
    process.env.PUBLISHER_CRON_SECRET ||
      process.env.SOCIAL_PUBLISHER_CRON_SECRET ||
      process.env.CLIP_FACTORY_CRON_SECRET ||
      process.env.CRON_SECRET ||
      "",
  ).trim();
  const provided = String(
    req.headers["x-cron-secret"] ||
      req.headers["x-publisher-cron-secret"] ||
      req.headers.authorization?.toString().replace(/^Bearer\s+/i, "") ||
      req.query.secret ||
      "",
  ).trim();
  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await tickPublisherWorker("cron");
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "tick_failed", message: message.slice(0, 300) });
  }
}
