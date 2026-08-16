import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    if (!user) return jsonResponse({ error: "Authentication required" }, 401);

    const body = await readJson<{
      amount?: number;
      currency?: string;
      method?: string;
      payout_details?: Record<string, unknown>;
    }>(req);

    const amount = Number(body.amount || 0);
    if (!Number.isFinite(amount) || amount < 10) {
      return jsonResponse({ error: "Minimum withdrawal is 10" }, 400);
    }

    const service = getServiceClient();
    const { data: profile } = await service
      .from("affiliate_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) return jsonResponse({ error: "Affiliate profile not found" }, 404);

    const available = Number(profile.available_earnings ?? 0);
    if (amount > available) {
      return jsonResponse({ error: "Amount exceeds available earnings" }, 400);
    }

    const { data: pending } = await service
      .from("affiliate_withdrawals")
      .select("id")
      .eq("affiliate_user_id", user.id)
      .eq("status", "pending")
      .limit(1);
    if (pending && pending.length > 0) {
      return jsonResponse({ error: "A pending withdrawal already exists" }, 400);
    }

    const { error: insertErr } = await service.from("affiliate_withdrawals").insert({
      affiliate_user_id: user.id,
      amount,
      currency: body.currency || "USD",
      method: body.method || "paypal",
      payout_details: body.payout_details || {},
      status: "pending",
    });
    if (insertErr) throw insertErr;

    await service
      .from("affiliate_profiles")
      .update({ available_earnings: available - amount })
      .eq("user_id", user.id);

    return jsonResponse({ ok: true, message: "Withdrawal requested" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
