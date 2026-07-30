// Legacy alias used by unused checkoutHandler.ts
import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, readJson } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user, authHeader } = await getAuthUser(req);
    const body = await readJson<{ pack?: string; quantity?: number; userId?: string | null }>(req);
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anon) return jsonResponse({ error: "Missing SUPABASE_URL/ANON" }, 500);

    const res = await fetch(`${url}/functions/v1/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: authHeader || `Bearer ${anon}`,
      },
      body: JSON.stringify({
        pack: body.pack,
        plan: body.pack,
        product_type: "credits",
        quantity: body.quantity || 1,
        user_id: body.userId || user?.id || null,
        email: user?.email,
        source: "tdg",
      }),
    });
    const data = await res.json();
    if (!res.ok) return jsonResponse(data, res.status);
    return jsonResponse({ url: data.url || data.checkoutUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
