/**
 * Dog V2 fulfillment capacity probe (Vercel).
 * Same semantics as supabase/functions/pet-provider-status — used because Edge deploy
 * requires SUPABASE_ACCESS_TOKEN which may be unavailable. Fail-closed when Replicate
 * cannot fulfill paid generation.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const UNAVAILABLE =
  "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.";

function json(res: VercelResponse, body: Record<string, unknown>, status = 200) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
    res.send("");
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    json(res, { available: false, reason: "method_not_allowed", message: UNAVAILABLE }, 405);
    return;
  }

  try {
    const kill = String(process.env.PET_FULFILLMENT_ENABLED || "true").trim().toLowerCase();
    if (kill === "0" || kill === "false" || kill === "off" || kill === "disabled") {
      json(res, { available: false, reason: "kill_switch", message: UNAVAILABLE });
      return;
    }

    const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
    if (!token) {
      json(res, { available: false, reason: "missing_token", message: UNAVAILABLE });
      return;
    }

    const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
      /\/$/,
      "",
    );
    const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (supabaseUrl && serviceKey) {
      const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { count } = await service
        .from("pet_orders")
        .select("id", { count: "exact", head: true })
        .eq("last_error", "billing_required")
        .gte("updated_at", since);
      if ((count || 0) >= 2) {
        json(res, { available: false, reason: "recent_billing_holds", message: UNAVAILABLE });
        return;
      }
    }

    const accountRes = await fetch("https://api.replicate.com/v1/account", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (accountRes.status === 402) {
      json(res, { available: false, reason: "insufficient_credit", message: UNAVAILABLE });
      return;
    }
    if (accountRes.status === 401 || accountRes.status === 403) {
      json(res, { available: false, reason: "provider_auth", message: UNAVAILABLE });
      return;
    }
    if (accountRes.status === 429) {
      json(res, { available: false, reason: "rate_limited", message: UNAVAILABLE });
      return;
    }
    if (!accountRes.ok) {
      json(res, { available: false, reason: "provider_error", message: UNAVAILABLE });
      return;
    }

    try {
      const body = (await accountRes.json()) as Record<string, unknown>;
      const credit =
        typeof body.credit === "number"
          ? body.credit
          : typeof body.balance === "number"
            ? body.balance
            : null;
      if (credit !== null && credit <= 0) {
        json(res, { available: false, reason: "insufficient_credit", message: UNAVAILABLE });
        return;
      }
    } catch {
      /* optional */
    }

    json(res, { available: true, reason: null, message: "ok" });
  } catch {
    json(res, { available: false, reason: "probe_failed", message: UNAVAILABLE });
  }
}
