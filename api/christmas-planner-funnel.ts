/**
 * Node origin port of supabase/functions/christmas-planner-funnel.
 * The self-hosted edge worker for this slug currently fails to boot
 * (missing entrypoint). Catalog, claim, and entitlement reads must still
 * work on the VPS origin. Checkout sessions stay on christmas-checkout.
 */
import { createHash } from "node:crypto";
import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { getAuthUser, getServiceClient, isServiceRoleRequest } from "./_lib/christmas/supabaseClient";
import {
  entitlementsForSelection,
  isPlannerAddonKey,
  isPlannerPackageKey,
  PLANNER_PRODUCT_KEY,
} from "../src/features/christmas/planner/commerce";

type Body = {
  action?: string;
  public_token?: string;
  package_key?: string;
  addon_keys?: string[];
  amount_cents?: number;
  currency?: string;
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function plannerCheckoutFlagEnabled(): boolean {
  const raw = asString(process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED).toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

function setCors(res: NodeApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function parseBody(req: NodeApiRequest): Body {
  const raw = req.body;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Body;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Body;
  return {};
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

function isPlannerProductKeySafe(value: string) {
  return value === PLANNER_PRODUCT_KEY || value === "christmas_planner";
}

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).send("ok");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = parseBody(req);
    const action = asString(body.action);
    const service = getServiceClient();
    const authHeader = String(req.headers.authorization || "");
    const { user } = await getAuthUser(authHeader);

    if (action === "getCatalog") {
      const { data: product, error } = await service
        .from("christmas_products")
        .select("id, product_key, name, description, active, public_discoverable, sort_order, route_path, metadata")
        .eq("product_key", PLANNER_PRODUCT_KEY)
        .maybeSingle();
      if (error) throw error;
      if (!product) return res.status(404).json({ error: "not_found" });
      const { data: packages, error: pkgError } = await service
        .from("christmas_packages")
        .select("*")
        .eq("product_id", product.id)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (pkgError) throw pkgError;
      const meta = (product.metadata || {}) as Record<string, unknown>;
      const rows = packages || [];
      return res.status(200).json({
        ok: true,
        catalog: {
          productKey: product.product_key,
          name: product.name,
          description: product.description,
          checkoutLive: meta.checkout_live === true || plannerCheckoutFlagEnabled(),
          seasonYear: Number(meta.season_year) || 2026,
          packages: rows
            .filter((pkg) => pkg.package_key === "founding_pass")
            .filter((pkg) => isPlannerPackageKey(pkg.package_key))
            .filter((pkg) => {
              const pkgMeta = (pkg.metadata || {}) as Record<string, unknown>;
              if (pkgMeta.publicOffer === false) return false;
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
              badge: (pkg.metadata as { badge?: string } | null)?.badge || null,
              highlight: Boolean((pkg.metadata as { highlight?: boolean } | null)?.highlight),
              entitlements: entitlementsForSelection({ packageKey: pkg.package_key, addonKeys: [] }),
            })),
          addons: rows
            .filter((pkg) => isPlannerAddonKey(pkg.package_key))
            .filter(() => !rows.some((row) => row.package_key === "founding_pass"))
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

    if (action === "getOrder") {
      const token = asString(body.public_token);
      if (token.length < 22) return res.status(400).json({ error: "invalid_token" });
      const hash = sha256Hex(token);
      const { data: order, error } = await service
        .from("christmas_orders")
        .select(
          "id,product_key,package_key,payment_status,fulfillment_status,amount_cents,currency,email,user_id,metadata,landing_path,utm_source,affiliate_ref",
        )
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!order || !isPlannerProductKeySafe(String(order.product_key))) {
        return res.status(404).json({ error: "not_found" });
      }
      return res.status(200).json({ ok: true, order: publicOrderDto(order) });
    }

    if (action === "claimOrder") {
      if (!user?.id) return res.status(401).json({ error: "auth_required", code: "auth_required" });
      const token = asString(body.public_token);
      if (token.length < 22) return res.status(400).json({ error: "invalid_token" });
      const hash = sha256Hex(token);
      const { data, error } = await service.rpc("claim_christmas_planner_order", {
        p_user_id: user.id,
        p_public_token_hash: hash,
      });
      if (error) throw error;
      const result = (data || {}) as Record<string, unknown>;
      if (result.ok !== true) {
        const reason = String(result.reason || "claim_failed");
        const status = reason === "already_claimed" ? 409 : reason === "not_paid" ? 402 : 400;
        return res.status(status).json({ error: reason, code: reason });
      }
      return res.status(200).json({
        ok: true,
        already: Boolean(result.already),
        orderId: result.order_id,
        packageKey: result.package_key,
      });
    }

    if (action === "myEntitlements") {
      if (!user?.id) return res.status(401).json({ error: "auth_required" });
      const { data, error } = await service
        .from("user_entitlements")
        .select("id,product_key,entitlement_key,tier,season_year,status,source,christmas_order_id,starts_at,expires_at")
        .eq("user_id", user.id)
        .eq("product_key", PLANNER_PRODUCT_KEY)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, entitlements: data || [] });
    }

    if (action === "adminGrant" || action === "adminRevoke") {
      if (!isServiceRoleRequest(authHeader)) {
        return res.status(403).json({ error: "admin_origin_unavailable" });
      }
      return res.status(403).json({ error: "admin_origin_unavailable" });
    }

    return res.status(400).json({ error: "unknown_action" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
