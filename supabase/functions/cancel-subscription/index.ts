import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return jsonResponse({ error: "STRIPE_SECRET_KEY is not configured" }, 503);
    }

    const { user } = await getAuthUser(req);
    if (!user) return jsonResponse({ error: "Authentication required" }, 401);

    const body = await readJson<{ cancel_at_period_end?: boolean }>(req);
    const service = getServiceClient();

    const { data: customer, error } = await service
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!customer) return jsonResponse({ error: "No customer record found" }, 404);

    const subscriptionId =
      customer.stripe_subscription_id ||
      customer.subscription_id ||
      customer.metadata?.stripe_subscription_id;

    if (!subscriptionId) {
      return jsonResponse({
        ok: false,
        message: "No Stripe subscription id on customer. Schema may need stripe_subscription_id.",
      }, 400);
    }

    const params = new URLSearchParams();
    params.set("cancel_at_period_end", String(body.cancel_at_period_end !== false));

    const stripeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const sub = await stripeRes.json();
    if (!stripeRes.ok) {
      return jsonResponse({ ok: false, message: sub.error?.message || "Stripe error" }, 502);
    }

    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    await service
      .from("customers")
      .update({
        cancel_at_period_end: true,
        subscription_status: sub.status,
        current_period_end: periodEnd,
      })
      .eq("user_id", user.id);

    return jsonResponse({
      ok: true,
      subscription_status: sub.status,
      current_period_end: periodEnd,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
