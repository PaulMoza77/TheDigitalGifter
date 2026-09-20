export type RecipeCatalogRow = {
  id: string;
  slug?: string;
  title: string;
  description: string;
  teaser: boolean;
  entitlement_key: string;
  category: string;
  tags: string[];
  prep_minutes: number;
  cook_minutes: number;
  servings: number;
  image_path: string | null;
  ingredients: unknown;
  steps?: unknown;
  cuisine_country?: string | null;
  cuisine_region?: string | null;
  course?: string | null;
  difficulty?: string | null;
  dietary?: string[] | null;
  allergens?: string[] | null;
};

export type RecipeFilters = {
  query?: string;
  country?: string;
  region?: string;
  course?: string;
  dietary?: string;
  allergen?: string;
  difficulty?: string;
  maxPrepMinutes?: number | null;
  savedOnly?: boolean;
};

const COURSE_FROM_CATEGORY: Record<string, string> = {
  christmas_dinner: "main",
  side_dishes: "side",
  desserts: "dessert",
  cookies: "dessert",
  drinks: "drink",
  breakfast: "breakfast",
  vegetarian: "side",
  make_ahead: "make_ahead",
  easy: "main",
  family_kids: "dessert",
};

export function recipeCourse(recipe: RecipeCatalogRow): string {
  const explicit = String(recipe.course || "").trim().toLowerCase();
  if (explicit) return explicit;
  return COURSE_FROM_CATEGORY[recipe.category] || "other";
}

export function recipeDifficulty(recipe: RecipeCatalogRow): string {
  const explicit = String(recipe.difficulty || "").trim().toLowerCase();
  if (explicit) return explicit;
  const tags = (recipe.tags || []).join(" ").toLowerCase();
  if (/\b(hard|advanced)\b/.test(tags)) return "advanced";
  if (/\bmedium\b/.test(tags)) return "medium";
  if (/\beasy\b/.test(tags)) return "easy";
  const total = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
  if (total <= 30) return "easy";
  if (total <= 90) return "medium";
  return "advanced";
}

export function recipeDietary(recipe: RecipeCatalogRow): string[] {
  if (recipe.dietary?.length) return recipe.dietary.map((d) => d.toLowerCase());
  const tags = (recipe.tags || []).map((t) => t.toLowerCase());
  const out: string[] = [];
  if (tags.some((t) => t.includes("vegetarian") || recipe.category === "vegetarian")) out.push("vegetarian");
  if (tags.some((t) => t.includes("vegan"))) out.push("vegan");
  if (tags.some((t) => t.includes("gluten-free") || t.includes("gluten free"))) out.push("gluten-free");
  return out;
}

export function recipeAllergens(recipe: RecipeCatalogRow): string[] {
  if (recipe.allergens?.length) return recipe.allergens.map((a) => a.toLowerCase());
  const blob = `${(recipe.tags || []).join(" ")} ${JSON.stringify(recipe.ingredients || [])}`.toLowerCase();
  const found: string[] = [];
  if (/\b(nut|walnut|almond|peanut|hazelnut)\b/.test(blob)) found.push("nuts");
  if (/\b(milk|cream|butter|cheese|dairy)\b/.test(blob)) found.push("dairy");
  if (/\b(egg|eggs)\b/.test(blob)) found.push("eggs");
  if (/\b(gluten|flour|bread|wheat)\b/.test(blob)) found.push("gluten");
  return found;
}

export function recipeCountry(recipe: RecipeCatalogRow): string {
  return String(recipe.cuisine_country || "international").trim().toLowerCase() || "international";
}

export function recipeRegion(recipe: RecipeCatalogRow): string {
  return String(recipe.cuisine_region || "").trim().toLowerCase();
}

export function filterRecipes(
  recipes: RecipeCatalogRow[],
  filters: RecipeFilters,
  savedIds: Set<string> = new Set(),
): RecipeCatalogRow[] {
  const q = String(filters.query || "")
    .trim()
    .toLowerCase();
  return recipes.filter((recipe) => {
    if (filters.savedOnly && !savedIds.has(recipe.id)) return false;
    if (q) {
      const hay = `${recipe.title} ${recipe.description} ${(recipe.tags || []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.country && filters.country !== "all" && recipeCountry(recipe) !== filters.country) return false;
    if (filters.region && filters.region !== "all" && recipeRegion(recipe) !== filters.region) return false;
    if (filters.course && filters.course !== "all" && recipeCourse(recipe) !== filters.course) return false;
    if (filters.dietary && filters.dietary !== "all" && !recipeDietary(recipe).includes(filters.dietary)) return false;
    if (filters.allergen && filters.allergen !== "all" && recipeAllergens(recipe).includes(filters.allergen)) {
      return false;
    }
    if (filters.difficulty && filters.difficulty !== "all" && recipeDifficulty(recipe) !== filters.difficulty) {
      return false;
    }
    if (filters.maxPrepMinutes != null && recipe.prep_minutes > filters.maxPrepMinutes) return false;
    return true;
  });
}

export function uniqueFacetValues(recipes: RecipeCatalogRow[], facet: "country" | "region" | "course" | "difficulty"): string[] {
  const set = new Set<string>();
  for (const recipe of recipes) {
    if (facet === "country") set.add(recipeCountry(recipe));
    if (facet === "region") {
      const region = recipeRegion(recipe);
      if (region) set.add(region);
    }
    if (facet === "course") set.add(recipeCourse(recipe));
    if (facet === "difficulty") set.add(recipeDifficulty(recipe));
  }
  return [...set].sort();
}

export function scaleIngredientList(ingredients: unknown, fromServings: number, toServings: number): unknown[] {
  const list = Array.isArray(ingredients) ? ingredients : [];
  const factor = fromServings > 0 ? toServings / fromServings : 1;
  return list.map((raw) => {
    if (raw && typeof raw === "object") {
      const obj = raw as { name?: string; quantity?: number; unit?: string };
      const qty = typeof obj.quantity === "number" ? Math.round(obj.quantity * factor * 100) / 100 : obj.quantity;
      return { ...obj, quantity: qty };
    }
    return raw;
  });
}
