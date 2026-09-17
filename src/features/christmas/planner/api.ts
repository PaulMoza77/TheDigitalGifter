import { supabase } from "@/lib/supabase";
import { PLANNER_PRODUCT_KEY } from "./commerce";
import { startChristmasCheckout } from "../photoApi";
import { attributionParamsForInternal, captureFunnelAttribution } from "@/features/pet/funnelAttribution";

const FUNNEL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-planner-funnel`;

async function headers(): Promise<Record<string, string>> {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  const out: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: anon,
  };
  const { data } = await supabase.auth.getSession();
  out.Authorization = `Bearer ${data.session?.access_token || anon}`;
  return out;
}

export type PlannerCatalogPackage = {
  packageKey: string;
  packageName: string;
  description: string;
  currency: string;
  priceCents: number;
  compareAtCents: number | null;
  purchasable: boolean;
  features: string[];
  badge: string | null;
  highlight: boolean;
  entitlements: string[];
};

export type PlannerCatalogAddon = {
  packageKey: string;
  packageName: string;
  description: string;
  currency: string;
  priceCents: number;
  purchasable: boolean;
};

export type PlannerCatalog = {
  productKey: string;
  name: string;
  description: string;
  checkoutLive: boolean;
  seasonYear: number;
  packages: PlannerCatalogPackage[];
  addons: PlannerCatalogAddon[];
};

export async function fetchPlannerCatalog(): Promise<PlannerCatalog> {
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ action: "getCatalog", product_key: PLANNER_PRODUCT_KEY }),
  });
  const data = await res.json();
  if (!res.ok || !data?.catalog) throw new Error(data.error || "catalog_failed");
  return data.catalog as PlannerCatalog;
}

export async function fetchPlannerOrder(publicToken: string) {
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ action: "getOrder", public_token: publicToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "order_failed");
  return data.order as {
    orderId: string;
    productKey: string;
    packageKey: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    amountCents: number;
    currency: string;
    hasEmail: boolean;
    claimed: boolean;
    userId: string | null;
    addonKeys: string[];
  };
}

export async function claimPlannerOrder(publicToken: string) {
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ action: "claimOrder", public_token: publicToken }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "claim_failed") as Error & { code?: string };
    err.code = data.code || data.error;
    throw err;
  }
  return data as { ok: true; already: boolean; orderId: string; packageKey: string };
}

export async function fetchMyPlannerEntitlements() {
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ action: "myEntitlements" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "entitlements_failed");
  return (data.entitlements || []) as Array<{
    entitlement_key: string;
    tier: string | null;
    status: string;
    source: string;
    christmas_order_id: string | null;
  }>;
}

export async function startPlannerCheckout(input: {
  packageKey: string;
  addonKeys: string[];
  email?: string;
  guestToken: string;
  funnelSessionId: string;
  existingOrderId?: string | null;
}) {
  const origin = window.location.origin;
  captureFunnelAttribution(window.location.search);
  const attr = attributionParamsForInternal();
  return startChristmasCheckout({
    product_key: PLANNER_PRODUCT_KEY,
    package_key: input.packageKey,
    addon_keys: input.addonKeys,
    email: input.email || undefined,
    guest_token: input.guestToken,
    funnel_session_id: input.funnelSessionId,
    landing_path: `${window.location.pathname}${window.location.search}`.slice(0, 120),
    source_route: "/christmas/planner",
    existing_order_id: input.existingOrderId || undefined,
    utm_source: attr.utm_source,
    utm_medium: attr.utm_medium,
    utm_campaign: attr.utm_campaign,
    utm_content: attr.utm_content,
    utm_term: attr.utm_term,
    campaign_id: attr.campaign_id,
    adset_id: attr.adset_id,
    ad_id: attr.ad_id,
    success_url: `${origin}/christmas/planner/welcome?checkout=success`,
    cancel_url: `${origin}/christmas/planner?checkout=canceled`,
  });
}
