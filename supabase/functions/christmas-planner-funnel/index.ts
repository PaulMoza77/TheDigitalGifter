import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, isServiceRoleRequest, readJson, assertAdmin } from "../_shared/supabase.ts";
import { asString } from "../_shared/christmas/crypto.ts";
import {
  entitlementsForSelection,
  isPlannerAddonKey,
  isPlannerPackageKey,
  PLANNER_PRODUCT_KEY,
  resolvePlannerCheckoutFromRows,
} from "../_shared/christmas/plannerCommerce.ts";

type Body = {
  action?: string;
  public_token?: string;
  package_key?: string;
  addon_keys?: string[];
  amount_cents?: number;
  currency?: string;
  entitlement_key?: string;
  user_id?: string;
  tier?: string;
  reason?: string;
};

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isPlannerProductKeySafe(value: string) {
  return value === PLANNER_PRODUCT_KEY || value === "christmas_planner";
}

function publicOrderDto(order: Record<string, unknown>) {
  const meta = (order.metadata || {}) as Record<string, unknown>;
  const addons = Array.isArray(meta.addon_keys)
    ? meta.addon_keys
    : String(meta.addon_keys || "")
        .split(",")
        .filter(Boolean);
  return {
    orderId: order.id,
    productKey: order.product_key,
    packageKey: order.package_key,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    amountCents: order.amount_cents,
    currency: order.currency,
    hasEmail: Boolean(order.email),
    claimed: Boolean(order.user_id),
    userId: order.user_id || null,
    addonKeys: addons,
    landingPath: order.landing_path,
    utmSource: order.utm_source,
    affiliateRef: order.affiliate_ref,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();
    const { user } = await getAuthUser(req);

    if (action === "getCatalog") {
      const { data: product, error } = await service
        .from("christmas_products")
        .select(
          "id, product_key, name, description, active, public_discoverable, sort_order, route_path, metadata",
        )
        .eq("product_key", PLANNER_PRODUCT_KEY)
        .maybeSingle();
      if (error) throw error;
      if (!product) return jsonResponse({ error: "not_found" }, 404);
      const { data: packages, error: pkgError } = await service
        .from("christmas_packages")
        .select("*")
        .eq("product_id", product.id)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (pkgError) throw pkgError;
      const meta = (product.metadata || {}) as Record<string, unknown>;
      return jsonResponse({
        ok: true,
        catalog: {
          productKey: product.product_key,
          name: product.name,
          description: product.description,
          checkoutLive:
            meta.checkout_live === true ||
            ["true", "1", "on"].includes(String(Deno.env.get("CHRISTMAS_PLANNER_CHECKOUT_ENABLED") || "").trim().toLowerCase()),
          seasonYear: Number(meta.season_year) || 2026,
          packages: (packages || [])
            .filter((pkg) => pkg.package_key === "founding_pass")
            .filter((pkg) => isPlannerPackageKey(pkg.package_key))
            .filter((pkg) => {
              const meta = (pkg.metadata || {}) as Record<string, unknown>;
              if (meta.publicOffer === false) return false;
              return true;
            })
            .map((pkg) => ({
              packageKey: pkg.package_key,
              packageName: pkg.package_name,
              description: pkg.description,
              currency: pkg.currency,
              priceCents: pkg.price_cents,
              compareAtCents: pkg.compare_at_cents,
              purchasable: pkg.purchasable,
              features: Array.isArray(pkg.features) ? pkg.features : [],
              badge: pkg.metadata?.badge || null,
              highlight: Boolean(pkg.metadata?.highlight),
              entitlements: entitlementsForSelection(pkg.package_key, []),
            })),
          addons: (packages || [])
            .filter((pkg) => isPlannerAddonKey(pkg.package_key))
            .filter(() => !(packages || []).some((row) => row.package_key === "founding_pass"))
            .map((pkg) => ({
              packageKey: pkg.package_key,
              packageName: pkg.package_name,
              description: pkg.description,
              currency: pkg.currency,
              priceCents: pkg.price_cents,
              purchasable: pkg.purchasable,
            })),
        },
      });
    }

    if (action === "previewAmount") {
      const { data: productRow } = await service
        .from("christmas_products")
        .select("id, product_key, name, active, metadata")
        .eq("product_key", PLANNER_PRODUCT_KEY)
        .maybeSingle();
      const { data: packages } = await service
        .from("christmas_packages")
        .select("*")
        .eq("product_id", productRow?.id || "00000000-0000-0000-0000-000000000000");
      const plan = resolvePlannerCheckoutFromRows({
        product: productRow || {
          product_key: PLANNER_PRODUCT_KEY,
          name: "Christmas Planner",
          active: false,
          metadata: {},
        },
        packages: packages || [],
        packageKey: asString(body.package_key),
        addonKeys: Array.isArray(body.addon_keys) ? body.addon_keys.map(String) : [],
        clientAmountCents: body.amount_cents,
        clientCurrency: body.currency,
        christmasCheckoutEnabled: true,
      });
      return jsonResponse(plan);
    }

    if (action === "getOrder") {
      const token = asString(body.public_token);
      if (token.length < 22) return jsonResponse({ error: "invalid_token" }, 400);
      const hash = await sha256Hex(token);
      const { data: order, error } = await service
        .from("christmas_orders")
        .select(
          "id,product_key,package_key,payment_status,fulfillment_status,amount_cents,currency,email,user_id,metadata,landing_path,utm_source,affiliate_ref",
        )
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!order || !isPlannerProductKeySafe(String(order.product_key))) {
        return jsonResponse({ error: "not_found" }, 404);
      }
      return jsonResponse({ ok: true, order: publicOrderDto(order) });
    }

    if (action === "claimOrder") {
      if (!user?.id) return jsonResponse({ error: "auth_required", code: "auth_required" }, 401);
      const token = asString(body.public_token);
      if (token.length < 22) return jsonResponse({ error: "invalid_token" }, 400);
      const hash = await sha256Hex(token);
      const { data, error } = await service.rpc("claim_christmas_planner_order", {
        p_user_id: user.id,
        p_public_token_hash: hash,
      });
      if (error) throw error;
      const result = (data || {}) as Record<string, unknown>;
      if (result.ok !== true) {
        const reason = String(result.reason || "claim_failed");
        const status = reason === "already_claimed" ? 409 : reason === "not_paid" ? 402 : 400;
        return jsonResponse({ error: reason, code: reason }, status);
      }
      return jsonResponse({
        ok: true,
        already: Boolean(result.already),
        orderId: result.order_id,
        packageKey: result.package_key,
      });
    }

    if (action === "myEntitlements") {
      if (!user?.id) return jsonResponse({ error: "auth_required" }, 401);
      const { data, error } = await service
        .from("user_entitlements")
        .select(
          "id,product_key,entitlement_key,tier,season_year,status,source,christmas_order_id,starts_at,expires_at",
        )
        .eq("user_id", user.id)
        .eq("product_key", PLANNER_PRODUCT_KEY)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return jsonResponse({ ok: true, entitlements: data || [] });
    }

    if (action === "adminGrant" || action === "adminRevoke") {
      if (!isServiceRoleRequest(req)) {
        await assertAdmin(user?.email);
      }
      const targetUser = asString(body.user_id);
      const key = asString(body.entitlement_key);
      const status = action === "adminRevoke" ? "revoked" : "active";
      const { data, error } = await service.rpc("admin_set_christmas_planner_entitlement", {
        p_user_id: targetUser,
        p_entitlement_key: key,
        p_status: status,
        p_tier: asString(body.tier) || null,
        p_season_year: 2026,
        p_reason: asString(body.reason) || null,
      });
      if (error) throw error;
      return jsonResponse({ ok: true, result: data });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
