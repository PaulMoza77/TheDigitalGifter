import type { VercelRequest, VercelResponse } from "@vercel/node";
import { originAllowed, persistV2WriteFailure, writePetV2FunnelEvent } from "./_lib/petV2";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const origin = String(req.headers.origin || "");
  const host = String(req.headers.host || "");
  if (origin && !originAllowed(origin, host)) {
    void persistV2WriteFailure({ eventName: "unknown", category: "origin_denied" });
    return res.status(403).json({ error: "Forbidden" });
  }
  let eventName = "unknown";
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    eventName = String((body as { event_name?: unknown }).event_name || "unknown");
    const result = await writePetV2FunnelEvent(req.body);
    return res.status(202).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "write_failed";
    if (message === "invalid_event" || message === "invalid_session" || message === "malformed_json") {
      void persistV2WriteFailure({ eventName, category: message });
      return res.status(400).json({ error: message });
    }
    const category = message.startsWith("rpc_")
      ? "rpc_error"
      : message === "missing_supabase_config"
        ? "missing_supabase_config"
        : "write_failed";
    void persistV2WriteFailure({ eventName, category });
    return res.status(500).json({ error: "write_failed" });
  }
}
