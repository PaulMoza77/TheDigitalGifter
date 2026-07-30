import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import {
  assertAdmin,
  getAuthUser,
  getServiceClient,
  readJson,
  requiredEnv,
} from "../_shared/supabase.ts";

type PricingItem = Record<string, unknown>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    await assertAdmin(user?.email);

    const body = await readJson<{
      action?: string;
      item?: PricingItem;
      id?: string;
      key?: string;
      create_new_price?: boolean;
      price_eur?: number | null;
    }>(req);

    const action = String(body.action || "list");
    const service = getServiceClient();

    if (action === "list") {
      const { data, error } = await service
        .from("pricing_items")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return jsonResponse({ items: data ?? [] });
    }

    if (action === "delete") {
      let query = service.from("pricing_items").delete();
      if (body.id) query = query.eq("id", body.id);
      else if (body.key) query = query.eq("key", body.key);
      else return jsonResponse({ error: "id or key required" }, 400);
      const { error } = await query;
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "save") {
      const item = body.item || {};
      if (!item.key || !item.name) {
        return jsonResponse({ error: "key and name are required" }, 400);
      }

      let stripePriceId = (item.stripe_price_id as string) || null;
      let stripeProductId = (item.stripe_product_id as string) || null;

      if (body.create_new_price) {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) {
          return jsonResponse(
            { error: "STRIPE_SECRET_KEY is not configured on this project" },
            503,
          );
        }
        const priceEur = Number(body.price_eur ?? 0);
        if (!Number.isFinite(priceEur) || priceEur <= 0) {
          return jsonResponse({ error: "price_eur must be > 0 to create Stripe price" }, 400);
        }

        // Create product if missing
        if (!stripeProductId) {
          const productRes = await fetch("https://api.stripe.com/v1/products", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${stripeKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              name: String(item.name),
              "metadata[key]": String(item.key),
            }),
          });
          const product = await productRes.json();
          if (!productRes.ok) {
            return jsonResponse({ error: product.error?.message || "Stripe product failed" }, 502);
          }
          stripeProductId = product.id;
        }

        const unitAmount = Math.round(priceEur * 100);
        const priceRes = await fetch("https://api.stripe.com/v1/prices", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            product: stripeProductId!,
            currency: String(item.currency || "eur"),
            unit_amount: String(unitAmount),
            "metadata[key]": String(item.key),
          }),
        });
        const price = await priceRes.json();
        if (!priceRes.ok) {
          return jsonResponse({ error: price.error?.message || "Stripe price failed" }, 502);
        }
        stripePriceId = price.id;
      }

      const row = {
        ...item,
        stripe_price_id: stripePriceId,
        stripe_product_id: stripeProductId,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await service
        .from("pricing_items")
        .upsert(row, { onConflict: item.id ? "id" : "key" })
        .select("*")
        .maybeSingle();

      if (error) {
        // Fallback: update by id or insert
        if (item.id) {
          const { data: updated, error: upErr } = await service
            .from("pricing_items")
            .update(row)
            .eq("id", item.id)
            .select("*")
            .maybeSingle();
          if (upErr) throw upErr;
          return jsonResponse({ item: updated, stripe_price_id: stripePriceId });
        }
        const { data: inserted, error: inErr } = await service
          .from("pricing_items")
          .insert(row)
          .select("*")
          .maybeSingle();
        if (inErr) throw inErr;
        return jsonResponse({ item: inserted, stripe_price_id: stripePriceId });
      }

      return jsonResponse({ item: data, stripe_price_id: stripePriceId });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.startsWith("Forbidden") || message.includes("Admin") ? 403 : 500;
    return jsonResponse({ error: message }, status);
  }
});
