import { supabase } from "@/lib/supabase";
import type {
  BudgetEntry,
  GiftItem,
  GiftRecipient,
  PlannerAccess,
  PlannerFeatureKey,
  PlannerProfile,
  PlannerTask,
} from "./types";

export type PlannerCatalogRow = {
  productKey: string;
  packageKey: string;
  packageName: string;
  description: string;
  currency: string;
  priceCents: number;
  purchasable: boolean;
  active: boolean;
  features: string[];
  sortOrder: number;
  recommended: boolean;
  addon: boolean;
};

export async function fetchPlannerCatalog(): Promise<PlannerCatalogRow[]> {
  const { data: products, error } = await supabase
    .from("christmas_products")
    .select("id, product_key, active")
    .like("product_key", "christmas_planner%")
    .eq("active", true);
  if (error || !products?.length) return [];
  const ids = products.map((p) => p.id);
  const { data: packages } = await supabase
    .from("christmas_packages")
    .select("product_id, package_key, package_name, description, currency, price_cents, purchasable, active, features, sort_order, metadata")
    .in("product_id", ids)
    .eq("active", true);
  const byId = new Map(products.map((p) => [p.id, p.product_key]));
  return (packages || []).map((pkg) => {
    const productKey = String(byId.get(pkg.product_id) || "");
    const meta = (pkg.metadata || {}) as Record<string, unknown>;
    const features = Array.isArray(pkg.features)
      ? pkg.features.map(String)
      : [];
    return {
      productKey,
      packageKey: String(pkg.package_key),
      packageName: String(pkg.package_name),
      description: String(pkg.description || ""),
      currency: String(pkg.currency || "eur"),
      priceCents: Number(pkg.price_cents || 0),
      purchasable: Boolean(pkg.purchasable),
      active: Boolean(pkg.active),
      features,
      sortOrder: Number(pkg.sort_order || 0),
      recommended: Boolean(meta.recommended),
      addon: productKey !== "christmas_planner" || Boolean(meta.planner_addon),
    };
  });
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

export async function fetchPlannerAccess(): Promise<PlannerAccess | null> {
  await supabase.rpc("claim_christmas_planner_grants_for_user");
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
