export const RECIPE_CATEGORIES = [
  "christmas_dinner",
  "side_dishes",
  "desserts",
  "cookies",
  "drinks",
  "breakfast",
  "easy",
  "make_ahead",
  "vegetarian",
  "family_kids",
] as const;

export const ALLOWED_UNITS = new Set([
  "g",
  "kg",
  "ml",
  "l",
  "tbsp",
  "tsp",
  "cup",
  "pinch",
  "handful",
  "piece",
  "clove",
  "leaf",
  "sprig",
]);

export type CatalogIngredient = {
  name: string;
  quantity: number;
  unit: string;
  optional?: boolean;
};

export type CatalogRecipe = {
  slug: string;
  title: string;
  description: string;
  country: string;
  region: string;
  cuisine: string;
  course: string;
  category: (typeof RECIPE_CATEGORIES)[number];
  dietary: string[];
  allergens: string[];
  difficulty: "easy" | "medium" | "advanced";
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  costBand: "low" | "mid" | "high";
  occasions: string[];
  tags: string[];
  notes: string;
  ingredients: CatalogIngredient[];
  steps: string[];
  entitlementKey: "free" | "recipes";
  teaser: boolean;
};

export type CatalogIssue = { slug: string; field: string; message: string };

function slugOk(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 80;
}

export function validateCatalogRecipe(recipe: CatalogRecipe): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const push = (field: string, message: string) => issues.push({ slug: recipe.slug || "(missing)", field, message });
  if (!slugOk(recipe.slug || "")) push("slug", "Slug must be 2–80 kebab-case characters.");
  if (!recipe.title || recipe.title.length < 3 || recipe.title.length > 120) push("title", "Title must be 3–120 characters.");
  if (!recipe.description || recipe.description.length < 24) push("description", "Description is too short.");
  if (!recipe.country) push("country", "Country is required.");
  if (!recipe.course) push("course", "Course is required.");
  if (!RECIPE_CATEGORIES.includes(recipe.category)) push("category", "Category is not allowed by the christmas_recipes table.");
  if (!["easy", "medium", "advanced"].includes(recipe.difficulty)) push("difficulty", "Difficulty is invalid.");
  if (!Number.isInteger(recipe.servings) || recipe.servings < 1 || recipe.servings > 50) {
    push("servings", "Servings must be an integer from 1 to 50.");
  }
  if (!Number.isInteger(recipe.prepMinutes) || recipe.prepMinutes < 0 || recipe.prepMinutes > 24 * 60) {
    push("prepMinutes", "Prep time is impossible.");
  }
  if (!Number.isInteger(recipe.cookMinutes) || recipe.cookMinutes < 0 || recipe.cookMinutes > 24 * 60) {
    push("cookMinutes", "Cook time is impossible.");
  }
  if (!["low", "mid", "high"].includes(recipe.costBand)) push("costBand", "Cost band is invalid.");
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 3) push("ingredients", "At least 3 ingredients are required.");
  const names = new Set<string>();
  for (const ing of recipe.ingredients || []) {
    const name = String(ing?.name || "").trim().toLowerCase();
    if (!name) push("ingredients", "Ingredient name is empty.");
    if (names.has(name)) push("ingredients", `Duplicate ingredient “${name}”.`);
    names.add(name);
    if (typeof ing.quantity !== "number" || !(ing.quantity > 0) || !Number.isFinite(ing.quantity)) {
      push("ingredients", `Quantity missing or invalid for ${name || "item"}.`);
    }
    if (!ALLOWED_UNITS.has(String(ing.unit || ""))) push("ingredients", `Malformed unit for ${name || "item"}.`);
  }
  if (!Array.isArray(recipe.steps) || recipe.steps.length < 4) push("steps", "At least 4 instruction steps are required.");
  for (const step of recipe.steps || []) {
    if (String(step || "").trim().length < 16) push("steps", "An instruction step is empty or too short.");
  }
  const blob = `${recipe.title} ${recipe.description} ${recipe.steps.join(" ")}`.toLowerCase();
  if (/\b(lorem ipsum|todo|tbd|placeholder|xxx)\b/.test(blob)) push("content", "Incomplete placeholder copy.");
  return issues;
}

export function validateCatalog(recipes: CatalogRecipe[]): {
  ok: boolean;
  count: number;
  countries: string[];
  cuisines: string[];
  issues: CatalogIssue[];
} {
  const issues: CatalogIssue[] = [];
  const slugs = new Set<string>();
  const titles = new Map<string, string>();
  for (const recipe of recipes) {
    issues.push(...validateCatalogRecipe(recipe));
    if (slugs.has(recipe.slug)) issues.push({ slug: recipe.slug, field: "slug", message: "Duplicate slug." });
    slugs.add(recipe.slug);
    const titleKey = recipe.title.trim().toLowerCase();
    if (titles.has(titleKey)) {
      issues.push({ slug: recipe.slug, field: "title", message: `Duplicate title of ${titles.get(titleKey)}.` });
    }
    titles.set(titleKey, recipe.slug);
  }
  const countries = [...new Set(recipes.map((r) => r.country))].sort();
  const cuisines = [...new Set(recipes.map((r) => r.cuisine))].sort();
  return { ok: issues.length === 0, count: recipes.length, countries, cuisines, issues };
}
