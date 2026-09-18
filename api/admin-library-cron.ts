import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getServiceClient } from "./_lib/christmas/supabaseClient";
import { syncOpenJobs } from "./_lib/higgsfield/jobs";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const cronSecret = String(process.env.PET_ANALYTICS_CRON_SECRET || process.env.CRON_SECRET || "").trim();
  const provided = String(
    req.headers["x-cron-secret"] ||
      req.headers.authorization?.toString().replace(/^Bearer\s+/i, "") ||
      req.query.secret ||
      "",
  ).trim();
  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const n = await syncOpenJobs(getServiceClient());
  return res.status(200).json({ ok: true, synced: n });
}
