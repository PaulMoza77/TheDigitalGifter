/**
 * Fulfillment capacity probe for Dog V2 payment gate.
 * Returns available=false when Replicate cannot accept work (402 / kill-switch / recent billing holds).
 * Does not expose secrets or raw provider payloads to the client.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ available: false, reason: "method_not_allowed" }, 405);
  }

  try {
    const kill = String(Deno.env.get("PET_FULFILLMENT_ENABLED") || "true").trim().toLowerCase();
    if (kill === "0" || kill === "false" || kill === "off" || kill === "disabled") {
      return jsonResponse({
        available: false,
        reason: "kill_switch",
        message:
          "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.",
      });
    }

    const token = String(Deno.env.get("REPLICATE_API_TOKEN") || "").trim();
    if (!token) {
      return jsonResponse({
        available: false,
        reason: "missing_token",
        message:
          "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.",
      });
    }

    // Recent paid orders held for billing_required → treat as outage.
    const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
    const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    if (supabaseUrl && serviceKey) {
      const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { count } = await service
        .from("pet_orders")
        .select("id", { count: "exact", head: true })
        .eq("last_error", "billing_required")
        .gte("updated_at", since);
      if ((count || 0) >= 2) {
        return jsonResponse({
          available: false,
          reason: "recent_billing_holds",
          message:
            "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.",
        });
      }
    }

    // Lightweight account probe — 402 / auth failures mean do not accept payment.
    const accountRes = await fetch("https://api.replicate.com/v1/account", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (accountRes.status === 402) {
      return jsonResponse({
        available: false,
        reason: "insufficient_credit",
        message:
          "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.",
      });
    }
    if (accountRes.status === 401 || accountRes.status === 403) {
      return jsonResponse({
        available: false,
        reason: "provider_auth",
        message:
          "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.",
      });
    }
    if (accountRes.status === 429) {
      return jsonResponse({
        available: false,
        reason: "rate_limited",
        message:
          "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.",
      });
    }
    if (!accountRes.ok) {
      return jsonResponse({
        available: false,
        reason: "provider_error",
        message:
          "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.",
      });
    }

    // Some accounts return credit fields — treat zero/negative as unavailable when present.
    try {
      const body = (await accountRes.json()) as Record<string, unknown>;
      const credit =
        typeof body.credit === "number"
          ? body.credit
          : typeof body.balance === "number"
            ? body.balance
            : null;
      if (credit !== null && credit <= 0) {
        return jsonResponse({
          available: false,
          reason: "insufficient_credit",
          message:
            "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.",
        });
      }
    } catch {
      /* account JSON optional */
    }

    return jsonResponse({
      available: true,
      reason: null,
      message: "ok",
    });
  } catch {
    return jsonResponse(
      {
        available: false,
        reason: "probe_failed",
        message:
          "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.",
      },
      200,
    );
  }
});
