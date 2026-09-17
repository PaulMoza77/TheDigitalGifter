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
