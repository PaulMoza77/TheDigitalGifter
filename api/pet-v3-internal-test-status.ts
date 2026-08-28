import type { VercelRequest, VercelResponse } from "@vercel/node";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const sessionId = String(body.funnel_session_id || "").trim();
  if (!UUID_RE.test(sessionId)) {
    return res.status(400).json({ authorized: false, expiresAt: null });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ authorized: false, expiresAt: null });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/pet_v3_internal_test_session_status`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_funnel_session_id: sessionId }),
    });
    if (!response.ok) {
      return res.status(200).json({ authorized: false, expiresAt: null });
    }
    const payload = (await response.json()) as { authorized?: boolean; expires_at?: string | null };
    return res.status(200).json({
      authorized: Boolean(payload.authorized),
      expiresAt: payload.expires_at ? String(payload.expires_at) : null,
    });
  } catch {
    return res.status(200).json({ authorized: false, expiresAt: null });
  }
}
