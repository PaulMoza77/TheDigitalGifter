import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { tickClipFactory } from "./_lib/clip-factory/worker";
import { tickLongForm } from "./_lib/long-form-studio/worker";
import { tickPublisherWorker } from "./_lib/publisher/service";
import { tickContentAutopilot } from "./_lib/content-autopilot/worker";

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const cronSecret = String(
    process.env.CLIP_FACTORY_CRON_SECRET || process.env.CRON_SECRET || process.env.SOCIAL_PUBLISHER_CRON_SECRET || "",
  ).trim();
  const provided = String(
    req.headers["x-cron-secret"] ||
      req.headers.authorization?.toString().replace(/^Bearer\s+/i, "") ||
      req.query.secret ||
      "",
  ).trim();
  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const clip = await tickClipFactory("cron");
    const longForm = await tickLongForm("cron");
    const contentAutopilot = await tickContentAutopilot("cron");
    const publisher = await tickPublisherWorker("cron");
    return res.status(200).json({ ok: true, ...clip, longForm, contentAutopilot, publisher });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "tick_failed", message: message.slice(0, 300) });
  }
}
