import type { GroceryAisle } from "../types";
import { GROCERY_AISLES } from "../types";
import type {
  FoodCompleteness,
  GroceryMergeRow,
  NormalizedIngredient,
  PlannerSnapshot,
  PrepSuggestion,
  ServingScaleHint,
  SnapshotDish,
  SnapshotRecipe,
} from "./types";

const RECOMMENDED_MEAL_CATEGORIES: Record<string, string[]> = {
  christmas_day: ["main", "sides", "dessert", "drinks"],
  christmas_eve: ["main", "sides", "dessert"],
};

const MAIN_HINTS = /\b(roast|turkey|ham|goose|beef|lamb|centrepiece|centerpiece|main|nut roast|wellington)\b/i;
const SIDE_HINTS = /\b(potato|potatoes|carrot|sprout|stuffing|gravy|side|veg|vegetable|salad|bread)\b/i;
const DESSERT_HINTS = /\b(dessert|pudding|pie|cake|trifle|log|cookie|brownie|tart|ice cream)\b/i;
const DRINK_HINTS = /\b(drink|wine|sparkler|punch|cocoa|mulled|champagne|juice|cocktail)\b/i;

const UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  cup: "cup",
  cups: "cup",
  pinch: "pinch",
  handful: "handful",
};

const AISLE_HINTS: Array<[GroceryAisle, RegExp]> = [
  ["produce", /\b(carrot|potato|onion|garlic|lemon|orange|thyme|rosemary|spinach|cranberry|herb|zest)\b/i],
  ["meat", /\b(turkey|ham|beef|chicken|lamb|goose|bacon)\b/i],
  ["dairy", /\b(butter|milk|cheese|cream|egg|eggs|yoghurt|yogurt)\b/i],
  ["bakery", /\b(bread|flour|pastry|roll)\b/i],
  ["drinks", /\b(juice|wine|ale|sparkler|champagne|cocoa)\b/i],
  ["pantry", /\b(honey|oil|salt|pepper|sugar|stock|spice)\b/i],
];

export function guestCount(snapshot: PlannerSnapshot): number {
  if (!snapshot.profile.hosting) return 0;
  if (!snapshot.guests.length) return 0;
  return snapshot.guests.reduce((s, g) => s + Math.max(0, g.adults) + Math.max(0, g.kids), 0);
}

export function parseIngredient(raw: unknown): { name: string; quantity: number | null; unit: string | null } | null {
  if (raw == null) return null;
  if (typeof raw === "object") {
    const obj = raw as { name?: string; quantity?: number | string; unit?: string; qty?: number };
    const name = String(obj.name || "").trim();
    if (!name) return null;
    const qty = obj.quantity ?? obj.qty;
    const quantity = typeof qty === "number" ? qty : qty ? Number(String(qty).replace(/[^\d.]/g, "")) : null;
    return { name, quantity: Number.isFinite(quantity as number) ? (quantity as number) : null, unit: obj.unit || null };
  }
  const text = String(raw).trim();
  if (!text) return null;
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tbsp|tsp|cups?|tablespoons?|teaspoons?|pinch|handful)?\s+(.*)$/i);
  if (match) {
    const unitRaw = (match[2] || "").toLowerCase();
    const unit = UNIT_ALIASES[unitRaw] || (unitRaw || null);
    return { name: match[3].replace(/,.*$/, "").trim(), quantity: Number(match[1]), unit };
  }
  return { name: text.replace(/,.*$/, "").trim(), quantity: null, unit: null };
}

export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fresh|halved|chopped|diced|sliced|optional|pinch|handful)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aisleFor(name: string): GroceryAisle {
  for (const [aisle, re] of AISLE_HINTS) {
    if (re.test(name)) return aisle;
  }
  return "other";
}

export function scaleQuantity(quantity: number | null, fromServings: number, toServings: number): number | null {
  if (quantity == null || !fromServings || fromServings === toServings) return quantity;
  return Math.round((quantity * (toServings / fromServings)) * 100) / 100;
}

export function ingredientsFromRecipe(
  recipe: SnapshotRecipe,
  mealServings: number,
): NormalizedIngredient[] {
  const list = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const scaleFrom = recipe.servings || 1;
  const map = new Map<string, NormalizedIngredient>();
  for (const raw of list) {
    const parsed = parseIngredient(raw);
    if (!parsed) continue;
    const name = normalizeIngredientName(parsed.name);
    if (!name) continue;
    const qty = scaleQuantity(parsed.quantity, scaleFrom, mealServings);
    const unit = parsed.unit;
    const key = `${name}|${unit || ""}`;
    const existing = map.get(key);
    if (existing) {
      if (existing.quantity != null && qty != null) existing.quantity += qty;
      existing.sources.push(recipe.title);
      existing.displayQuantity = formatQty(existing.quantity, existing.unit);
      continue;
    }
    map.set(key, {
      key,
      name,
      quantity: qty,
      unit,
      aisle: aisleFor(name),
      displayQuantity: formatQty(qty, unit),
      sources: [recipe.title],
    });
  }
  return [...map.values()];
}

function formatQty(quantity: number | null, unit: string | null): string {
  if (quantity == null) return unit || "";
  const n = Number.isInteger(quantity) ? String(quantity) : String(quantity);
  return unit ? `${n} ${unit}` : n;
}

export function aggregateMealIngredients(snapshot: PlannerSnapshot): NormalizedIngredient[] {
  const recipes = new Map(snapshot.recipes.map((r) => [r.id, r]));
  const map = new Map<string, NormalizedIngredient>();
  for (const dish of snapshot.dishes) {
    if (!dish.recipe_id) continue;
    const recipe = recipes.get(dish.recipe_id);
    if (!recipe) continue;
    for (const item of ingredientsFromRecipe(recipe, dish.servings || recipe.servings)) {
      const existing = map.get(item.key);
      if (!existing) {
        map.set(item.key, { ...item, sources: [...item.sources] });
        continue;
      }
      if (existing.quantity != null && item.quantity != null && existing.unit === item.unit) {
        existing.quantity += item.quantity;
        existing.displayQuantity = formatQty(existing.quantity, existing.unit);
      }
      existing.sources.push(...item.sources);
    }
  }
  return [...map.values()].sort((a, b) => a.aisle.localeCompare(b.aisle) || a.name.localeCompare(b.name));
}

function parseAisle(name: string): { aisle: GroceryAisle; label: string } {
  const [maybe, rest] = name.split("|");
  if (rest && (GROCERY_AISLES as readonly string[]).includes(maybe)) {
    return { aisle: maybe as GroceryAisle, label: rest };
  }
  return { aisle: "other", label: name };
}

export function mergeGroceryList(snapshot: PlannerSnapshot): GroceryMergeRow[] {
  const derived = aggregateMealIngredients(snapshot);
  const rows = new Map<string, GroceryMergeRow>();
  for (const item of derived) {
    rows.set(item.key, {
      key: item.key,
      name: item.name,
      aisle: item.aisle,
      displayQuantity: item.displayQuantity,
      status: "need",
      persistedId: null,
      derived: true,
    });
  }
  for (const stored of snapshot.grocery) {
    const parsed = parseAisle(stored.name);
    const key = `${normalizeIngredientName(parsed.label)}|`;
    const existing = rows.get(key) || [...rows.values()].find((r) => r.name === normalizeIngredientName(parsed.label));
    if (existing) {
      existing.status = stored.status;
      existing.persistedId = stored.id;
      if (stored.quantity) existing.displayQuantity = stored.quantity;
      continue;
    }
    const freshKey = `manual:${stored.id}`;
    rows.set(freshKey, {
      key: freshKey,
      name: parsed.label,
      aisle: parsed.aisle,
      displayQuantity: stored.quantity,
      status: stored.status,
      persistedId: stored.id,
      derived: false,
    });
  }
  return [...rows.values()];
}

function classifyDish(dish: SnapshotDish, recipe?: SnapshotRecipe): string | null {
  if (recipe?.category === "christmas_dinner") return "main";
  if (recipe?.category === "side_dishes") return "sides";
  if (recipe?.category === "desserts" || recipe?.category === "cookies") return "dessert";
  if (recipe?.category === "drinks") return "drinks";
  const text = `${dish.dish_name} ${recipe?.title || ""}`;
  if (DESSERT_HINTS.test(text)) return "dessert";
  if (DRINK_HINTS.test(text)) return "drinks";
  if (SIDE_HINTS.test(text)) return "sides";
  if (MAIN_HINTS.test(text)) return "main";
  return null;
}

export function detectFoodCompleteness(input: {
  meals: PlannerSnapshot["meals"];
  dishes: PlannerSnapshot["dishes"];
  recipes: PlannerSnapshot["recipes"];
}): FoodCompleteness[] {
  const recipes = new Map(input.recipes.map((r) => [r.id, r]));
  const out: FoodCompleteness[] = [];
  for (const meal of input.meals) {
    const recommended = RECOMMENDED_MEAL_CATEGORIES[meal.section];
    if (!recommended) continue;
    const dishes = input.dishes.filter((d) => d.meal_id === meal.id);
    if (!dishes.length) continue;
    const present = new Set<string>();
    for (const dish of dishes) {
      const kind = classifyDish(dish, dish.recipe_id ? recipes.get(dish.recipe_id) : undefined);
      if (kind) present.add(kind);
    }
    if (meal.section === "desserts") present.add("dessert");
    if (meal.section === "drinks") present.add("drinks");
    out.push({
      mealId: meal.id,
      section: meal.section,
      title: meal.title,
      present: recommended.filter((c) => present.has(c)),
      missing: recommended.filter((c) => !present.has(c)),
    });
  }
  return out;
}

export function servingHints(snapshot: PlannerSnapshot): ServingScaleHint[] {
  const guests = guestCount(snapshot);
  if (!guests) return [];
  const recipes = new Map(snapshot.recipes.map((r) => [r.id, r]));
  return snapshot.dishes
    .map((dish) => {
      const recipe = dish.recipe_id ? recipes.get(dish.recipe_id) : undefined;
      const recipeServings = recipe?.servings || dish.servings;
      return {
        dishId: dish.id,
        dishName: dish.dish_name,
        recipeServings,
        mealServings: dish.servings,
        guestCount: guests,
        suggestedServings: guests,
        needsScale: dish.servings < guests && recipeServings < guests,
      };
    })
    .filter((h) => h.needsScale);
}

function mealDate(snapshot: PlannerSnapshot, meal: { section: string; meal_on: string | null }): string {
  if (meal.meal_on) return meal.meal_on;
  if (meal.section === "christmas_day") return `${snapshot.season}-12-25`;
  if (meal.section === "christmas_eve") return `${snapshot.season}-12-24`;
  return snapshot.today;
}

function shiftIso(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function buildPrepTimeline(snapshot: PlannerSnapshot): PrepSuggestion[] {
  const recipes = new Map(snapshot.recipes.map((r) => [r.id, r]));
  const suggestions: PrepSuggestion[] = [];
  for (const meal of snapshot.meals) {
    const date = mealDate(snapshot, meal);
    for (const dish of snapshot.dishes.filter((d) => d.meal_id === meal.id)) {
      const recipe = dish.recipe_id ? recipes.get(dish.recipe_id) : undefined;
      const tags = recipe?.tags || [];
      const makeAhead = tags.some((t) => /make[- ]?ahead/i.test(t));
      const prep = dish.prep_minutes ?? recipe?.prep_minutes ?? null;
      const cook = dish.cook_minutes ?? recipe?.cook_minutes ?? null;
      if (makeAhead && prep) {
        suggestions.push({
          id: `prep-ahead:${dish.id}`,
          date: shiftIso(date, -2),
          time: null,
          title: `Prepare ${dish.dish_name}`,
          reason: "This recipe is marked make-ahead, so prep can start two days before the meal.",
        });
      } else if (prep && prep >= 20) {
        suggestions.push({
          id: `prep:${dish.id}`,
          date: shiftIso(date, -1),
          time: null,
          title: `Prep ${dish.dish_name}`,
          reason: `Listed prep time is ${prep} minutes.`,
        });
      }
      if (cook && cook > 0) {
        suggestions.push({
          id: `cook:${dish.id}`,
          date,
          time: dish.day_time || (meal.section === "christmas_day" ? "11:30" : null),
          title: `Start ${dish.dish_name}`,
          reason: `Listed cook time is ${cook} minutes.`,
        });
      }
    }
  }
  return suggestions.sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
}
