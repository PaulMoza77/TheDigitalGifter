import { supabase } from "@/lib/supabase";
import { PLANNER_PRODUCT_KEY } from "./commerce";
import { startChristmasCheckout } from "../photoApi";
import { attributionParamsForInternal, captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import type {
  BudgetEntry,
  GiftItem,
  GiftRecipient,
  PlannerAccess,
  PlannerFeatureKey,
  PlannerProfile,
  PlannerTask,
} from "./types";

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

/** Workspace access via SQL bridge over user_entitlements (single store). */
export async function fetchPlannerAccess(): Promise<PlannerAccess | null> {
  const { data, error } = await supabase.rpc("get_christmas_planner_access");
  if (error || !data) return null;
  const row = data as {
    ok?: boolean;
    season_year?: number;
    features?: string[];
    package_keys?: string[];
    paid?: boolean;
  };
  return {
    ok: Boolean(row.ok),
    season_year: Number(row.season_year || 0),
    features: (row.features || []) as PlannerFeatureKey[],
    package_keys: row.package_keys || [],
    paid: Boolean(row.paid),
  };
}

export function persistPlannerOrder(payload: Record<string, unknown>) {
  try {
    localStorage.setItem("tdg.christmas.planner.order.v1", JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function readPlannerOrder(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem("tdg.christmas.planner.order.v1");
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function loadProfile(seasonYear: number): Promise<PlannerProfile | null> {
  const { data } = await supabase
    .from("christmas_planner_profiles")
    .select("*")
    .eq("season_year", seasonYear)
    .maybeSingle();
  return (data as PlannerProfile | null) ?? null;
}

export async function upsertProfile(
  patch: Partial<PlannerProfile> & { season_year: number; user_id: string },
): Promise<PlannerProfile | null> {
  const { data, error } = await supabase
    .from("christmas_planner_profiles")
    .upsert(patch, { onConflict: "user_id,season_year" })
    .select("*")
    .maybeSingle();
  if (error) return null;
  return data as PlannerProfile;
}

export async function loadTasks(profileId: string): Promise<PlannerTask[]> {
  const { data } = await supabase
    .from("christmas_planner_tasks")
    .select("*")
    .eq("profile_id", profileId)
    .order("due_on", { ascending: true, nullsFirst: false });
  return (data as PlannerTask[]) || [];
}

export async function insertTasks(
  rows: Array<Omit<PlannerTask, "id"> & { id?: string }>,
): Promise<PlannerTask[]> {
  if (!rows.length) return [];
  const { data } = await supabase.from("christmas_planner_tasks").insert(rows).select("*");
  return (data as PlannerTask[]) || [];
}

export async function patchTask(id: string, patch: Partial<PlannerTask>): Promise<void> {
  await supabase.from("christmas_planner_tasks").update(patch).eq("id", id);
}

export async function loadRecipients(profileId: string): Promise<GiftRecipient[]> {
  const { data } = await supabase
    .from("christmas_gift_recipients")
    .select("*")
    .eq("profile_id", profileId)
    .order("sort_order");
  return (data as GiftRecipient[]) || [];
}

export async function loadGifts(profileId: string): Promise<GiftItem[]> {
  const { data } = await supabase
    .from("christmas_gift_items")
    .select("*")
    .eq("profile_id", profileId);
  return (data as GiftItem[]) || [];
}

export async function loadBudget(profileId: string): Promise<BudgetEntry[]> {
  const { data } = await supabase
    .from("christmas_budget_entries")
    .select("*")
    .eq("profile_id", profileId);
  return (data as BudgetEntry[]) || [];
}

export async function loadModuleRows<T>(table: string, profileId: string): Promise<T[]> {
  const { data } = await supabase.from(table).select("*").eq("profile_id", profileId);
  return (data as T[]) || [];
}
