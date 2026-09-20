import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NAMED_DISHES } from "./named-dishes.mjs";
import { REGIONAL_DISHES } from "./named-dishes-regions.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATEGORIES = new Set([
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
]);
const UNITS = new Set(["g", "kg", "ml", "l", "tbsp", "tsp", "cup", "pinch", "handful", "piece", "clove", "leaf", "sprig"]);

function normalizeIngredients(list) {
  return (list || []).map((row) => {
    if (Array.isArray(row)) {
      return { quantity: row[0], unit: row[1], name: row[2], optional: row[3] === "opt" || undefined };
    }
    return row;
  });
}

function normalize(recipe) {
  const ingredients = normalizeIngredients(recipe.ingredients).map((ing) => ({
    name: String(ing.name || "").trim(),
    quantity: Number(ing.quantity),
    unit: String(ing.unit || "").trim(),
    optional: Boolean(ing.optional) || undefined,
  }));
  return {
    slug: String(recipe.slug || "").trim(),
    title: String(recipe.title || "").trim(),
    description: String(recipe.description || "").trim(),
    country: String(recipe.country || "").trim(),
    region: String(recipe.region || "").trim(),
    cuisine: String(recipe.cuisine || recipe.country || "").trim(),
    course: recipe.course === "cookie" ? "dessert" : String(recipe.course || "").trim(),
    category: String(recipe.category || "").trim(),
    dietary: [...new Set((recipe.dietary || []).map((x) => String(x).toLowerCase()))],
    allergens: [...new Set((recipe.allergens || []).map((x) => String(x).toLowerCase()))],
    difficulty: String(recipe.difficulty || "medium"),
    prepMinutes: Number(recipe.prepMinutes || 0),
    cookMinutes: Number(recipe.cookMinutes || 0),
    servings: Number(recipe.servings || 0),
    costBand: String(recipe.costBand || "mid"),
    occasions: [...new Set(recipe.occasions || ["christmas"])],
    tags: [...new Set([...(recipe.tags || []), ...(recipe.occasions || []), recipe.country, recipe.course].filter(Boolean))],
    notes: String(recipe.notes || "").trim(),
    ingredients: ingredients.map(({ optional, ...rest }) => (optional ? { ...rest, optional: true } : rest)),
    steps: (recipe.steps || []).map((s) => String(s).trim()).filter(Boolean),
    entitlementKey: recipe.entitlementKey === "free" ? "free" : "recipes",
    teaser: Boolean(recipe.teaser),
  };
}

function issuesFor(recipe) {
  const issues = [];
  const push = (field, message) => issues.push({ slug: recipe.slug || "(missing)", field, message });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.slug) || recipe.slug.length < 2 || recipe.slug.length > 80) {
    push("slug", "bad slug");
  }
  if (recipe.title.length < 3 || recipe.title.length > 120) push("title", "bad title");
  if (recipe.description.length < 24) push("description", "short description");
  if (!recipe.country) push("country", "missing country");
  if (!recipe.course) push("course", "missing course");
  if (!CATEGORIES.has(recipe.category)) push("category", recipe.category);
  if (!["easy", "medium", "advanced"].includes(recipe.difficulty)) push("difficulty", recipe.difficulty);
  if (!Number.isInteger(recipe.servings) || recipe.servings < 1 || recipe.servings > 50) push("servings", String(recipe.servings));
  if (!Number.isInteger(recipe.prepMinutes) || recipe.prepMinutes < 0) push("prepMinutes", "bad");
  if (!Number.isInteger(recipe.cookMinutes) || recipe.cookMinutes < 0) push("cookMinutes", "bad");
  if (!["low", "mid", "high"].includes(recipe.costBand)) push("costBand", recipe.costBand);
  if (recipe.ingredients.length < 3) push("ingredients", "too few");
  const names = new Set();
  for (const ing of recipe.ingredients) {
    const name = ing.name.toLowerCase();
    if (!name) push("ingredients", "empty name");
    if (names.has(name)) push("ingredients", `dup ${name}`);
    names.add(name);
    if (!(ing.quantity > 0) || !Number.isFinite(ing.quantity)) push("ingredients", `qty ${name}`);
    if (!UNITS.has(ing.unit)) push("ingredients", `unit ${ing.unit} ${name}`);
  }
  if (recipe.steps.length < 4) push("steps", "too few");
  for (const step of recipe.steps) {
    if (step.length < 16) push("steps", "short step");
  }
  return issues;
}

const FREE_TEASERS = new Set([
  "herb-butter-roast-turkey",
  "creamy-mashed-potatoes",
  "jellied-cranberry-sauce",
  "classic-pumpkin-pie",
  "spiced-apple-cider",
]);

const recipes = [...NAMED_DISHES, ...REGIONAL_DISHES].map((raw) => {
  const recipe = normalize(raw);
  if (FREE_TEASERS.has(recipe.slug) || recipe.tags.includes("budget") && recipe.course === "drink") {
    // keep drinks paid unless explicitly listed
  }
  if (FREE_TEASERS.has(recipe.slug)) {
    recipe.entitlementKey = "free";
    recipe.teaser = true;
  }
  return recipe;
});
const issues = [];
const slugs = new Set();
const titles = new Set();
for (const recipe of recipes) {
  issues.push(...issuesFor(recipe));
  if (slugs.has(recipe.slug)) issues.push({ slug: recipe.slug, field: "slug", message: "duplicate slug" });
  slugs.add(recipe.slug);
  const t = recipe.title.toLowerCase();
  if (titles.has(t)) issues.push({ slug: recipe.slug, field: "title", message: "duplicate title" });
  titles.add(t);
}

const report = {
  ok: issues.length === 0,
  count: recipes.length,
  countries: [...new Set(recipes.map((r) => r.country))].sort(),
  cuisines: [...new Set(recipes.map((r) => r.cuisine))].sort(),
  courses: [...new Set(recipes.map((r) => r.course))].sort(),
  issues,
  generatedAt: new Date().toISOString(),
  license: "Original TDG methods. Traditional dish names are culinary facts, not copied headnotes.",
};

const outJson = resolve(ROOT, "src/features/christmas/planner/food/catalog/tdg-recipes.json");
const outReport = resolve(ROOT, "output/recipe-catalog-qa.json");
mkdirSync(dirname(outJson), { recursive: true });
mkdirSync(dirname(outReport), { recursive: true });
if (issues.length) {
  writeFileSync(outReport, JSON.stringify(report, null, 2));
  console.error(`CATALOG_INVALID issues=${issues.length} count=${recipes.length}`);
  console.error(JSON.stringify(issues.slice(0, 40), null, 2));
  process.exit(1);
}
writeFileSync(outJson, `${JSON.stringify(recipes)}\n`);
writeFileSync(outReport, JSON.stringify(report, null, 2));
console.log(`CATALOG_OK count=${recipes.length} countries=${report.countries.length} cuisines=${report.cuisines.length}`);
