import type { VercelRequest, VercelResponse } from "@vercel/node";
import { originAllowed, writePetV2FunnelEvent } from "../_lib/petV2";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const origin = String(req.headers.origin || "");
  const host = String(req.headers.host || "");
  if (origin && !originAllowed(origin, host)) return res.status(403).json({ error: "Forbidden" });
  try {
    const result = await writePetV2FunnelEvent(req.body);
    return res.status(202).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "write_failed";
    if (message === "invalid_event" || message === "invalid_session" || message === "malformed_json") {
      return res.status(400).json({ error: message });
    }
    return res.status(202).json({ ok: true, duplicate: false });
  }
}
