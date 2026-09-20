import { supabase } from "@/lib/supabase";
import { loadBudget, loadGifts, loadRecipients, loadTasks } from "../api";
import type { PlannerProfile } from "../types";
import { buildPlannerSnapshot, type WorkspaceRows } from "./snapshot";
import type { PlannerSnapshot, SnapshotDish, SnapshotEvent, SnapshotGrocery, SnapshotGuest, SnapshotHome, SnapshotMeal, SnapshotRecipe, SnapshotTrip } from "./types";

type Cache = { profileId: string; at: number; snapshot: PlannerSnapshot };
let cache: Cache | null = null;
const TTL_MS = 12_000;

export function invalidatePlannerSnapshot(profileId?: string) {
  if (!profileId || cache?.profileId === profileId) cache = null;
}

export async function loadPlannerWorkspace(profile: PlannerProfile, now = new Date()): Promise<PlannerSnapshot> {
  if (cache && cache.profileId === profile.id && Date.now() - cache.at < TTL_MS) {
    return cache.snapshot;
  }

  const [
    tasks,
    recipients,
    gifts,
    budgetEntries,
    mealsRes,
    dishesRes,
    recipesRes,
    groceryRes,
    guestsRes,
    homeRes,
    tripsRes,
    eventsRes,
    cardsRes,
    traditionsRes,
  ] = await Promise.all([
    loadTasks(profile.id),
    loadRecipients(profile.id),
    loadGifts(profile.id),
    loadBudget(profile.id),
    supabase.from("christmas_meals").select("id,section,title,meal_on").eq("profile_id", profile.id),
    supabase.from("christmas_meal_items").select("id,meal_id,recipe_id,dish_name,servings,prep_minutes,cook_minutes,day_time").eq("profile_id", profile.id),
    supabase.from("christmas_recipes").select("id,title,servings,prep_minutes,cook_minutes,category,tags,ingredients").eq("published", true),
    supabase.from("christmas_grocery_items").select("id,name,quantity,status,source_type,meal_item_id,ingredient_key").eq("profile_id", profile.id),
    supabase.from("christmas_guests").select("id,display_name,rsvp,adults,kids,dietary,sleeping").eq("profile_id", profile.id),
    supabase.from("christmas_home_items").select("id,title,area,status").eq("profile_id", profile.id),
    supabase.from("christmas_trips").select("id,destination,start_on,end_on,packing,gifts_to_take").eq("profile_id", profile.id),
    supabase.from("christmas_events").select("id,title,event_kind,starts_on,source_type,source_ref").eq("profile_id", profile.id),
    supabase.from("christmas_card_tracker").select("id,status").eq("profile_id", profile.id),
    supabase.from("christmas_traditions").select("id,status,scheduled_on").eq("profile_id", profile.id),
  ]);

  const rows: WorkspaceRows = {
    profile,
    tasks,
    recipients,
    gifts,
    budgetEntries,
    meals: (mealsRes.data as SnapshotMeal[]) || [],
    dishes: (dishesRes.data as SnapshotDish[]) || [],
    recipes: ((recipesRes.data || []) as SnapshotRecipe[]).map((r) => ({
      ...r,
      tags: r.tags || [],
    })),
    grocery: (groceryRes.data as SnapshotGrocery[]) || [],
    guests: ((guestsRes.data || []) as SnapshotGuest[]).map((g) => ({
      ...g,
      adults: g.adults ?? 1,
      kids: g.kids ?? 0,
    })),
    home: (homeRes.data as SnapshotHome[]) || [],
    trips: ((tripsRes.data || []) as SnapshotTrip[]).map((t) => ({
      ...t,
      packing: t.packing || "",
      gifts_to_take: t.gifts_to_take || "",
    })),
    events: (eventsRes.data as SnapshotEvent[]) || [],
    cards: (cardsRes.data as { id: string; status: string }[]) || [],
    traditions: (traditionsRes.data as { id: string; status: string; scheduled_on: string | null }[]) || [],
    now,
  };

  const snapshot = buildPlannerSnapshot(rows);
  cache = { profileId: profile.id, at: Date.now(), snapshot };
  return snapshot;
}
