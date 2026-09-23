import { supabase } from "@/lib/supabase";
import { loadBudget, loadGifts, loadRecipients, loadTasks } from "../api";
import { invalidatePlannerQueries } from "../plannerQueryCache";
import type { PlannerProfile } from "../types";
import { buildPlannerSnapshot, type WorkspaceRows } from "./snapshot";
import type {
  PlannerSnapshot,
  SnapshotDish,
  SnapshotEvent,
  SnapshotGrocery,
  SnapshotGuest,
  SnapshotHome,
  SnapshotMeal,
  SnapshotRecipe,
  SnapshotTrip,
} from "./types";

type Cache = { profileId: string; at: number; snapshot: PlannerSnapshot };
let cache: Cache | null = null;
let generation = 0;
let inflight: { profileId: string; generation: number; promise: Promise<PlannerSnapshot> } | null = null;

/** Shared shell data. Navigation reuses it; mutations call invalidate. */
const TTL_MS = 60_000;

export function invalidatePlannerSnapshot(profileId?: string) {
  if (!profileId || cache?.profileId === profileId) {
    cache = null;
    generation += 1;
  }
  invalidatePlannerQueries(profileId);
}

export async function loadPlannerWorkspace(profile: PlannerProfile, now = new Date()): Promise<PlannerSnapshot> {
  if (cache && cache.profileId === profile.id && Date.now() - cache.at < TTL_MS) {
    return cache.snapshot;
  }
  if (inflight && inflight.profileId === profile.id && inflight.generation === generation) {
    return inflight.promise;
  }

  const gen = generation;
  const promise = fetchPlannerWorkspace(profile, now)
    .then((snapshot) => {
      if (gen === generation) cache = { profileId: profile.id, at: Date.now(), snapshot };
      return snapshot;
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { profileId: profile.id, generation: gen, promise };
  return promise;
}

async function fetchPlannerWorkspace(profile: PlannerProfile, now: Date): Promise<PlannerSnapshot> {
  const [
    tasks,
    recipients,
    gifts,
    budgetEntries,
    mealsRes,
    dishesRes,
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
    supabase
      .from("christmas_meal_items")
      .select("id,meal_id,recipe_id,dish_name,servings,prep_minutes,cook_minutes,day_time")
      .eq("profile_id", profile.id),
    supabase
      .from("christmas_grocery_items")
      .select("id,name,quantity,status,source_type,meal_item_id,ingredient_key")
      .eq("profile_id", profile.id),
    supabase.from("christmas_guests").select("id,display_name,rsvp,adults,kids,dietary,sleeping").eq("profile_id", profile.id),
    supabase.from("christmas_home_items").select("id,title,area,status").eq("profile_id", profile.id),
    supabase.from("christmas_trips").select("id,destination,start_on,end_on,packing,gifts_to_take").eq("profile_id", profile.id),
    supabase.from("christmas_events").select("id,title,event_kind,starts_on,source_type,source_ref").eq("profile_id", profile.id),
    supabase.from("christmas_card_tracker").select("id,status").eq("profile_id", profile.id),
    supabase.from("christmas_traditions").select("id,status,scheduled_on").eq("profile_id", profile.id),
  ]);

  const dishes = (dishesRes.data as SnapshotDish[]) || [];
  const recipeIds = [...new Set(dishes.map((dish) => dish.recipe_id).filter((id): id is string => Boolean(id)))];
  let recipeRows: SnapshotRecipe[] = [];
  if (recipeIds.length) {
    const recipesRes = await supabase
      .from("christmas_recipes")
      .select("id,title,servings,prep_minutes,cook_minutes,category,tags,ingredients")
      .in("id", recipeIds);
    recipeRows = ((recipesRes.data || []) as SnapshotRecipe[]).map((recipe) => ({
      ...recipe,
      tags: recipe.tags || [],
    }));
  }

  const rows: WorkspaceRows = {
    profile,
    tasks,
    recipients,
    gifts,
    budgetEntries,
    meals: (mealsRes.data as SnapshotMeal[]) || [],
    dishes,
    recipes: recipeRows,
    grocery: (groceryRes.data as SnapshotGrocery[]) || [],
    guests: ((guestsRes.data || []) as SnapshotGuest[]).map((guest) => ({
      ...guest,
      adults: guest.adults ?? 1,
      kids: guest.kids ?? 0,
    })),
    home: (homeRes.data as SnapshotHome[]) || [],
    trips: ((tripsRes.data || []) as SnapshotTrip[]).map((trip) => ({
      ...trip,
      packing: trip.packing || "",
      gifts_to_take: trip.gifts_to_take || "",
    })),
    events: (eventsRes.data as SnapshotEvent[]) || [],
    cards: (cardsRes.data as { id: string; status: string }[]) || [],
    traditions: (traditionsRes.data as { id: string; status: string; scheduled_on: string | null }[]) || [],
    now,
  };

  return buildPlannerSnapshot(rows);
}
