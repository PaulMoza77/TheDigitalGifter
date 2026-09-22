import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { planGroceryRegeneration, planManualGroceryAdd } from "@/features/occasions/grocerySync";
import { CHRISTMAS_2026 } from "@/features/occasions/types";
import { trackPlannerEvent } from "../analytics";
import { detectFoodCompleteness, ingredientsFromRecipe, invalidatePlannerSnapshot } from "../intelligence";
import { hasFeature } from "../entitlements";
import { PlannerOnboarding, usePlannerBundle } from "../Onboarding";
import { PlannerPaywall } from "../Paywall";
import { GROCERY_AISLES, type GroceryAisle } from "../types";
import { PlannerEmptyState, PlannerPageHeader, PlannerLoading } from "../plannerUi";
import { bumpPlannerWorkspace } from "../workspaceSync";
import { applyGroceryOps } from "./persistGrocery";
import {
  RECIPE_DISCOVERY,
  applyDiscoveryChip,
  filterRecipes,
  formatMinutes,
  recipeCountry,
  recipeCourse,
  recipeDifficulty,
  scaleIngredientList,
  suggestMenu,
  uniqueFacetValues,
  type RecipeCatalogRow,
  type RecipeFilters,
} from "./recipeCatalog";
const FOOD_TABS = [
  ["christmas_eve", "Christmas Eve"],
  ["christmas_day", "Christmas Day"],
  ["breakfast", "Christmas Breakfast"],
  ["other", "Custom meal"],
] as const;

const AISLE_LABEL: Record<GroceryAisle, string> = {
  produce: "Produce",
  meat: "Meat",
  dairy: "Dairy",
  bakery: "Bakery",
  pantry: "Pantry",
  frozen: "Frozen",
  drinks: "Drinks",
  other: "Other",
};

type DishRow = {
  id: string;
  dish_name: string;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  notes: string;
  meal_id: string;
  recipe_id: string | null;
};

type MealRow = { id: string; section: string; title: string; guest_count?: number | null };

async function reloadGroceryDerived(profileId: string) {
  const [mealsRes, dishesRes, recipesRes, groceryRes] = await Promise.all([
    supabase.from("christmas_meals").select("id,section,title").eq("profile_id", profileId),
    supabase.from("christmas_meal_items").select("id,meal_id,recipe_id,dish_name,servings").eq("profile_id", profileId),
    supabase.from("christmas_recipes").select("id,title,servings,prep_minutes,cook_minutes,category,tags,ingredients").eq("published", true),
    supabase.from("christmas_grocery_items").select("id,name,quantity,status,source_type,meal_item_id,ingredient_key,source_notes").eq("profile_id", profileId),
  ]);
  const recipes = ((recipesRes.data || []) as Array<RecipeCatalogRow & { id: string }>).map((r) => ({
    id: r.id,
    title: r.title,
    servings: r.servings,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    category: r.category,
    tags: r.tags || [],
    ingredients: r.ingredients,
  }));
  const dishes = (dishesRes.data || []) as Array<{ id: string; meal_id: string; recipe_id: string | null; dish_name: string; servings: number }>;
  const derived = dishes.flatMap((dish) => {
    if (!dish.recipe_id) return [];
    const recipe = recipes.find((r) => r.id === dish.recipe_id);
    if (!recipe) return [];
    return ingredientsFromRecipe(recipe, dish.servings).map((item) => ({
      key: item.key,
      name: item.name,
      aisle: item.aisle,
      displayQuantity: item.displayQuantity,
      status: "need" as const,
      persistedId: null,
      derived: true,
      sources: item.sources,
    }));
  });
  const stored = (groceryRes.data || []) as Array<{
    id: string;
    name: string;
    quantity: string;
    status: "have" | "need" | "bought";
    source_type: string;
    meal_item_id: string | null;
    ingredient_key?: string | null;
  }>;
  const plan = planGroceryRegeneration({ derived, stored, occasion: CHRISTMAS_2026 });
  await applyGroceryOps(profileId, plan.ops);
  invalidatePlannerSnapshot(profileId);
}

const RECIPE_SELECT =
  "id,slug,title,description,teaser,entitlement_key,category,prep_minutes,cook_minutes,servings,image_path,ingredients,steps,tags,cuisine_country,cuisine_region,course,difficulty,dietary,allergens,notes";

export function ChristmasPlannerFoodPage() {
  const navigate = useNavigate();
  const { loading, access, profile } = usePlannerBundle();
  const [tab, setTab] = useState<(typeof FOOD_TABS)[number][0]>("christmas_day");
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeCatalogRow[]>([]);
  const [people, setPeople] = useState(8);
  const [diet, setDiet] = useState("all");
  const [country, setCountry] = useState("all");
  const [customTitle, setCustomTitle] = useState("");
  const [wizard, setWizard] = useState<"plan" | "menu">("plan");

  useEffect(() => {
    if (!profile) return;
    void Promise.all([
      supabase.from("christmas_meals").select("id,section,title,guest_count").eq("profile_id", profile.id),
      supabase.from("christmas_meal_items").select("id,dish_name,servings,prep_minutes,cook_minutes,notes,meal_id,recipe_id").eq("profile_id", profile.id),
      supabase.from("christmas_recipes").select(RECIPE_SELECT).eq("published", true),
      supabase.from("christmas_guests").select("adults,kids").eq("profile_id", profile.id),
    ]).then(([m, d, rec, guests]) => {
      setMeals((m.data as MealRow[]) || []);
      setDishes((d.data as DishRow[]) || []);
      setRecipes((rec.data as RecipeCatalogRow[]) || []);
      const list = (guests.data as Array<{ adults: number; kids: number }>) || [];
      const n = list.reduce((s, g) => s + (g.adults || 0) + (g.kids || 0), 0);
      if (n) setPeople(n);
    });
    trackPlannerEvent("planner_module_opened", { module: "food", metadata: { activation: "meals" } });
  }, [profile?.id]);

  const meal = meals.find((row) => row.section === tab);
  const sitting = dishes.filter((d) => d.meal_id === meal?.id);
  const totalPrep = sitting.reduce((s, d) => s + (d.prep_minutes || 0) + (d.cook_minutes || 0), 0);
  const headcount = meal?.guest_count || people;
  const groceryNeed = 0;

  if (loading) return <PlannerLoading label="Loading meals…" />;
  if (!profile) return <PlannerOnboarding />;
  if (!hasFeature(access, "food_planner")) {
    return (
      <div className="tdg-planner-page">
        <PlannerPageHeader title="Meals" lede="Occasion, guests, recipes, portions, menu, then grocery." />
        <PlannerPaywall feature="food_planner" title="Meals are part of Christmas Planner" body="Get my Christmas Planner for $17 to plan the occasion, guests, recipes, portions, menu, and grocery list." />
      </div>
    );
  }

  async function ensureMeal(guestCount = people) {
    if (meal) {
      if (guestCount && meal.guest_count !== guestCount) {
        await supabase.from("christmas_meals").update({ guest_count: guestCount }).eq("id", meal.id);
        setMeals((p) => p.map((row) => (row.id === meal.id ? { ...row, guest_count: guestCount } : row)));
      }
      return meal;
    }
    const title =
      tab === "other" ? customTitle.trim().slice(0, 120) || "Custom meal" : FOOD_TABS.find((t) => t[0] === tab)?.[1] || tab;
    const { data } = await supabase
      .from("christmas_meals")
      .insert({ profile_id: profile!.id, section: tab, title, guest_count: guestCount || null })
      .select("id,section,title,guest_count")
      .maybeSingle();
    if (data) setMeals((p) => [...p, data as MealRow]);
    return data as MealRow | null;
  }

  async function addRecipeToSitting(recipe: RecipeCatalogRow) {
    const host = await ensureMeal(people);
    if (!host) return;
    const { data } = await supabase
      .from("christmas_meal_items")
      .insert({
        profile_id: profile!.id,
        meal_id: host.id,
        recipe_id: recipe.id,
        dish_name: recipe.title.slice(0, 120),
        servings: people,
        prep_minutes: recipe.prep_minutes,
        cook_minutes: recipe.cook_minutes,
      })
      .select("id,dish_name,servings,prep_minutes,cook_minutes,notes,meal_id,recipe_id")
      .maybeSingle();
    if (data) setDishes((p) => [...p, data as DishRow]);
    await reloadGroceryDerived(profile!.id);
    bumpPlannerWorkspace();
    trackPlannerEvent("planner_meal_created", { module: "food" });
  }

  async function setServings(dish: DishRow, servings: number) {
    const next = Math.min(50, Math.max(1, servings));
    await supabase.from("christmas_meal_items").update({ servings: next }).eq("id", dish.id);
    setDishes((p) => p.map((x) => (x.id === dish.id ? { ...x, servings: next } : x)));
    await reloadGroceryDerived(profile!.id);
    bumpPlannerWorkspace();
  }

  const suggested = suggestMenu(recipes, {
    guests: people,
    dietary: diet,
    country,
    sitting: tab === "breakfast" ? "breakfast" : tab === "christmas_eve" ? "christmas_eve" : "christmas_day",
  });
  const completeness = detectFoodCompleteness({
    meals: meals.map((m) => ({ id: m.id, section: m.section, title: m.title, meal_on: null })),
    dishes: dishes.map((d) => ({
      id: d.id,
      meal_id: d.meal_id,
      recipe_id: d.recipe_id,
      dish_name: d.dish_name,
      servings: d.servings,
      prep_minutes: d.prep_minutes,
      cook_minutes: d.cook_minutes,
      day_time: "",
    })),
    recipes: recipes.map((r) => ({
      id: r.id,
      title: r.title,
      servings: r.servings,
      prep_minutes: r.prep_minutes,
      cook_minutes: r.cook_minutes,
      category: r.category,
      tags: r.tags || [],
      ingredients: r.ingredients,
    })),
  }).find((row) => row.mealId === meal?.id);

  const byCourse = (course: string) => sitting.filter((d) => {
    const recipe = recipes.find((r) => r.id === d.recipe_id);
    return recipe ? recipeCourse(recipe) === course : false;
  });

  return (
    <div className="tdg-planner-page tdg-food-product">
      <PlannerPageHeader title="Meals" lede="Occasion, guests, recipes, portions, menu, then grocery." />
      <ol className="tdg-meal-steps" aria-label="Meal steps">
        {[
          ["Occasion", true],
          ["Guests", people > 0],
          ["Recipes", sitting.length > 0],
          ["Portions", sitting.some((dish) => dish.servings > 0)],
          ["Menu", sitting.length > 0 && wizard === "menu"],
          ["Grocery", false],
        ].map(([label, on]) => (
          <li key={String(label)} className={on ? "is-on" : undefined}>
            {label}
          </li>
        ))}
      </ol>
      <div className="tdg-planner-seg" role="tablist">
        {FOOD_TABS.map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "other" ? (
        <input className="tdg-planner-input" placeholder="Name this meal" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
      ) : null}

      {sitting.length === 0 || wizard === "plan" ? (
        <section className="tdg-meal-wizard">
          <label>
            Guests
            <input className="tdg-planner-input" type="number" min={1} max={50} value={people} onChange={(e) => setPeople(Math.min(50, Math.max(1, Number(e.target.value || 1))))} />
          </label>
          <label>
            Food style
            <select className="tdg-planner-select" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="all">Any tradition</option>
              {uniqueFacetValues(recipes, "country").map((c) => (
                <option key={c} value={c}>
                  {c.replace(/-/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dietary
            <select className="tdg-planner-select" value={diet} onChange={(e) => setDiet(e.target.value)}>
              <option value="all">No restriction</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="gluten-free">Gluten-free</option>
            </select>
          </label>
          <button
            type="button"
            className="tdg-planner-btn primary tdg-sticky-cta"
            onClick={async () => {
              await ensureMeal(people);
              for (const recipe of suggested) {
                if (sitting.some((d) => d.recipe_id === recipe.id)) continue;
                await addRecipeToSitting(recipe);
              }
              setWizard("menu");
            }}
          >
            Suggest a menu
          </button>
          <Link className="tdg-planner-btn" to="/account/christmas/recipes">
            Choose recipes myself
          </Link>
        </section>
      ) : null}

      {sitting.length ? (
        <section className="tdg-meal-summary">
          <h2>{meal?.title || FOOD_TABS.find((t) => t[0] === tab)?.[1]}</h2>
          <p className="tdg-planner-muted">{headcount} guests</p>
          {["appetizer", "main", "side", "dessert"].map((course) => {
            const rows = byCourse(course);
            const leftover = course === "appetizer" ? sitting.filter((d) => !recipes.find((r) => r.id === d.recipe_id)) : [];
            const list = course === "main" ? [...rows, ...leftover.filter((d) => !byCourse("appetizer").includes(d) && !byCourse("side").includes(d) && !byCourse("dessert").includes(d))] : rows;
            if (!list.length) return null;
            return (
              <div key={course} className="tdg-meal-course">
                <h3>{course === "main" ? "Main" : course[0].toUpperCase() + course.slice(1)}</h3>
                {list.map((d) => (
                  <div key={d.id} className="tdg-planner-row">
                    <div>
                      <strong>{d.dish_name}</strong>
                      <div className="tdg-planner-muted">{d.prep_minutes || d.cook_minutes ? `${(d.prep_minutes || 0) + (d.cook_minutes || 0)} min` : ""}</div>
                    </div>
                    <label className="tdg-servings-inline">
                      Servings
                      <input
                        className="tdg-planner-input"
                        type="number"
                        min={1}
                        max={50}
                        value={d.servings}
                        onChange={(e) => void setServings(d, Number(e.target.value || d.servings))}
                      />
                    </label>
                  </div>
                ))}
              </div>
            );
          })}
          <p className="tdg-meal-totals">
            Estimated preparation: {formatMinutes(totalPrep)}
            {completeness?.missing.length ? ` · Menu still needs ${completeness.missing.join(", ")}` : " · Menu looks complete"}
          </p>
          <button type="button" className="tdg-planner-btn primary tdg-sticky-cta" onClick={() => navigate("/account/christmas/grocery")}>
            Open grocery
          </button>
        </section>
      ) : (
        <PlannerEmptyState mark="food" title="No dishes yet." body="Suggest a menu or pick recipes. Servings follow your guest count." />
      )}
      <p className="tdg-planner-muted">{groceryNeed ? `${groceryNeed} ingredients still needed.` : null}</p>
    </div>
  );
}

export function ChristmasPlannerRecipesPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [recipes, setRecipes] = useState<RecipeCatalogRow[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<RecipeFilters>({ query: "", course: "all", dietary: "all", difficulty: "all", country: "all" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [servings, setServings] = useState<Record<string, number>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => {
    void supabase.from("christmas_recipes").select(RECIPE_SELECT).eq("published", true).then(({ data }) => {
      setRecipes((data as RecipeCatalogRow[]) || []);
    });
    trackPlannerEvent("planner_module_opened", { module: "recipes", feature: "recipes", metadata: { activation: "recipes" } });
  }, []);

  useEffect(() => {
    if (!profile) return;
    void supabase
      .from("christmas_recipe_saves")
      .select("recipe_id")
      .eq("profile_id", profile.id)
      .then(({ data }) => setSaved(new Set(((data as Array<{ recipe_id: string }>) || []).map((r) => r.recipe_id))));
  }, [profile?.id]);

  const visible = useMemo(() => filterRecipes(recipes, filters, saved), [recipes, filters, saved]);
  const canAll = hasFeature(access, "recipes");
  const countries = uniqueFacetValues(recipes, "country");

  if (loading) return <PlannerLoading label="Loading recipes…" />;
  if (!profile) return <PlannerOnboarding />;

  async function addToMeal(recipe: RecipeCatalogRow, section: "christmas_eve" | "christmas_day") {
    const existing = await supabase.from("christmas_meals").select("id").eq("profile_id", profile!.id).eq("section", section).maybeSingle();
    let mealId = existing.data?.id;
    if (!mealId) {
      const created = await supabase
        .from("christmas_meals")
        .insert({ profile_id: profile!.id, section, title: section === "christmas_eve" ? "Christmas Eve" : "Christmas Day" })
        .select("id")
        .maybeSingle();
      mealId = created.data?.id;
    }
    if (!mealId) return;
    const serve = servings[recipe.id] || recipe.servings;
    await supabase.from("christmas_meal_items").insert({
      profile_id: profile!.id,
      meal_id: mealId,
      recipe_id: recipe.id,
      dish_name: recipe.title.slice(0, 120),
      servings: serve,
      prep_minutes: recipe.prep_minutes,
      cook_minutes: recipe.cook_minutes,
    });
    await reloadGroceryDerived(profile!.id);
    trackPlannerEvent("planner_meal_created", { module: "recipes" });
    setMenuFor(null);
  }

  async function addIngredients(recipe: RecipeCatalogRow) {
    const serve = servings[recipe.id] || recipe.servings;
    const items = ingredientsFromRecipe(
      {
        id: recipe.id,
        title: recipe.title,
        servings: recipe.servings,
        prep_minutes: recipe.prep_minutes,
        cook_minutes: recipe.cook_minutes,
        category: recipe.category,
        tags: recipe.tags || [],
        ingredients: recipe.ingredients,
      },
      serve,
    );
    const { data: stored } = await supabase
      .from("christmas_grocery_items")
      .select("id,name,quantity,status,source_type,meal_item_id,ingredient_key")
      .eq("profile_id", profile!.id);
    const derived = items.map((item) => ({
      key: item.key,
      name: item.name,
      aisle: item.aisle,
      displayQuantity: item.displayQuantity,
      status: "need" as const,
      persistedId: null,
      derived: true,
      sources: item.sources,
    }));
    const plan = planGroceryRegeneration({ derived, stored: (stored || []) as never, occasion: CHRISTMAS_2026 });
    await applyGroceryOps(profile!.id, plan.ops.filter((op) => op.op === "insert" || op.op === "update"));
  }

  return (
    <div className="tdg-planner-page tdg-food-product">
      <PlannerPageHeader title="Recipes" lede="Search, filter, cook. Add a dish to your Christmas menu or send the ingredients to the list." />
      <input
        className="tdg-planner-input tdg-recipe-search"
        placeholder="Search recipes..."
        value={filters.query || ""}
        onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
      />
      <div className="tdg-discovery" role="list">
        {RECIPE_DISCOVERY.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`tdg-planner-chip${filters.tag === ("tag" in chip ? chip.tag : "") || filters.course === ("course" in chip ? chip.course : "") || filters.dietary === ("dietary" in chip ? chip.dietary : "") ? " on" : ""}`}
            onClick={() => setFilters((p) => applyDiscoveryChip({ ...p, tag: undefined }, chip))}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <details className="tdg-recipe-filters">
        <summary>Filters</summary>
        <label>
          Country
          <select className="tdg-planner-select" value={filters.country || "all"} onChange={(e) => setFilters((p) => ({ ...p, country: e.target.value }))}>
            <option value="all">All</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c.replace(/-/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Course
          <select className="tdg-planner-select" value={filters.course || "all"} onChange={(e) => setFilters((p) => ({ ...p, course: e.target.value }))}>
            {["all", "appetizer", "main", "side", "dessert", "drink", "breakfast"].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label>
          Diet
          <select className="tdg-planner-select" value={filters.dietary || "all"} onChange={(e) => setFilters((p) => ({ ...p, dietary: e.target.value }))}>
            {["all", "vegetarian", "vegan", "gluten-free"].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select className="tdg-planner-select" value={filters.difficulty || "all"} onChange={(e) => setFilters((p) => ({ ...p, difficulty: e.target.value }))}>
            {["all", "easy", "medium", "advanced"].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prep time
          <select
            className="tdg-planner-select"
            value={String(filters.maxPrepMinutes ?? "all")}
            onChange={(e) => setFilters((p) => ({ ...p, maxPrepMinutes: e.target.value === "all" ? null : Number(e.target.value) }))}
          >
            <option value="all">Any</option>
            <option value="15">15 min</option>
            <option value="20">20 min</option>
            <option value="30">30 min</option>
            <option value="60">60 min</option>
          </select>
        </label>
      </details>
      {visible.length === 0 ? <PlannerEmptyState mark="food" title="No recipes match." body="Clear a filter or try another search." /> : null}
      <div className="tdg-recipe-grid">
        {visible.map((r) => {
          const locked = r.entitlement_key !== "free" && !r.teaser && !canAll;
          const serve = servings[r.id] || r.servings;
          const open = openId === r.id;
          const scaled = scaleIngredientList(r.ingredients, r.servings, serve);
          return (
            <article key={r.id} className="tdg-recipe-card">
              <button type="button" className="tdg-recipe-open" onClick={() => setOpenId(open ? null : r.id)}>
                <span className="tdg-recipe-art" aria-hidden />
                <strong>{r.title}</strong>
                <p className="tdg-planner-muted">
                  {recipeCountry(r).replace(/-/g, " ")} · {formatMinutes((r.prep_minutes || 0) + (r.cook_minutes || 0))} · {recipeDifficulty(r)}
                </p>
              </button>
              {open ? (
                <div className="tdg-recipe-detail">
                  <p>{r.description}</p>
                  <p className="tdg-planner-muted">
                    {r.servings} servings as written · {recipeCourse(r)}
                  </p>
                  <label className="tdg-servings-inline">
                    Servings
                    <input
                      className="tdg-planner-input"
                      type="number"
                      min={1}
                      max={50}
                      value={serve}
                      onChange={(e) => setServings((p) => ({ ...p, [r.id]: Math.min(50, Math.max(1, Number(e.target.value || r.servings))) }))}
                    />
                  </label>
                  <h3>Ingredients</h3>
                  <ul>
                    {scaled.map((raw, i) => {
                      const row = raw as { name?: string; quantity?: number; unit?: string };
                      return (
                        <li key={i}>
                          {row.quantity} {row.unit} {row.name}
                        </li>
                      );
                    })}
                  </ul>
                  <h3>Instructions</h3>
                  <ol>
                    {(Array.isArray(r.steps) ? r.steps : []).map((step, i) => (
                      <li key={i}>{String(step)}</li>
                    ))}
                  </ol>
                  {locked ? (
                    <PlannerPaywall feature="recipes" title="Full recipe pack" body="Save recipes, add them to meals, and roll ingredients into groceries." />
                  ) : (
                    <div className="tdg-planner-actions tdg-recipe-ctas">
                      <button type="button" className="tdg-planner-btn primary" onClick={() => setMenuFor(r.id)}>
                        Add to Christmas Menu
                      </button>
                      <button type="button" className="tdg-planner-btn" onClick={() => void addIngredients(r)}>
                        Add ingredients to Grocery List
                      </button>
                      <button
                        type="button"
                        className="tdg-planner-btn"
                        onClick={async () => {
                          await supabase.from("christmas_recipe_saves").insert({ profile_id: profile.id, recipe_id: r.id });
                          setSaved((p) => new Set([...p, r.id]));
                          trackPlannerEvent("planner_recipe_saved", { module: "recipes" });
                        }}
                      >
                        {saved.has(r.id) ? "Saved" : "Save recipe"}
                      </button>
                    </div>
                  )}
                  {menuFor === r.id ? (
                    <div className="tdg-planner-actions">
                      <button type="button" className="tdg-planner-btn primary" onClick={() => void addToMeal(r, "christmas_eve")}>
                        Christmas Eve
                      </button>
                      <button type="button" className="tdg-planner-btn primary" onClick={() => void addToMeal(r, "christmas_day")}>
                        Christmas Day
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function parseAisle(name: string): { aisle: GroceryAisle; label: string } {
  const [maybe, rest] = name.split("|");
  if (rest && (GROCERY_AISLES as readonly string[]).includes(maybe)) {
    return { aisle: maybe as GroceryAisle, label: rest };
  }
  return { aisle: "other", label: name };
}

export function ChristmasPlannerGroceryPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [items, setItems] = useState<
    Array<{ id: string; name: string; quantity: string; status: string; source_type: string; ingredient_key?: string | null; source_notes?: string | null }>
  >([]);
  const [draft, setDraft] = useState({ name: "", aisle: "other" as GroceryAisle, qty: "" });
  const [notice, setNotice] = useState<string | null>(null);

  async function reload() {
    if (!profile) return;
    const { data } = await supabase
      .from("christmas_grocery_items")
      .select("id,name,quantity,status,source_type,ingredient_key,source_notes")
      .eq("profile_id", profile.id);
    setItems((data as typeof items) || []);
  }

  useEffect(() => {
    if (!profile) return;
    void (async () => {
      await reloadGroceryDerived(profile.id);
      await reload();
    })();
    trackPlannerEvent("planner_module_opened", { module: "grocery", metadata: { activation: "grocery" } });
  }, [profile?.id]);

  if (loading) return <PlannerLoading label="Loading grocery…" />;
  if (!profile) return <PlannerOnboarding />;
  if (!hasFeature(access, "food_planner")) {
    return (
      <div className="tdg-planner-page">
        <PlannerPageHeader title="Grocery" lede="Food for the menu. Gift shopping is a separate list." />
        <PlannerPaywall feature="food_planner" title="Grocery is part of Christmas Planner" body="Get my Christmas Planner for $17 to keep one grocery list from your meals." />
      </div>
    );
  }

  const remaining = items.filter((it) => it.status === "need").length;

  return (
    <div className="tdg-planner-page tdg-food-product">
      <PlannerPageHeader title="Grocery" lede="Built from your menu. Tick what you have. This is food, not gift shopping." />
      <p className="tdg-planner-muted">{remaining} ingredients still needed</p>
      {notice ? <p className="tdg-planner-muted" role="status">{notice}</p> : null}
      <form
        className="tdg-grocery-add"
        onSubmit={async (event: FormEvent) => {
          event.preventDefault();
          if (!draft.name.trim()) return;
          const plan = planManualGroceryAdd({
            items,
            aisle: draft.aisle,
            label: draft.name.trim(),
            quantity: draft.qty,
          });
          if (plan.action === "duplicate") {
            setNotice(
              plan.reason === "incompatible_unit"
                ? "That item is already on the list with a different unit. Edit its quantity instead of adding it again."
                : "That item is already on the grocery list.",
            );
            return;
          }
          if (plan.action === "merge") {
            await supabase.from("christmas_grocery_items").update({ quantity: plan.quantity }).eq("id", plan.id).eq("profile_id", profile.id);
            setItems((prev) => prev.map((row) => (row.id === plan.id ? { ...row, quantity: plan.quantity } : row)));
            setNotice("Quantities combined on the existing grocery item.");
          } else {
            const { data } = await supabase
              .from("christmas_grocery_items")
              .insert({
                profile_id: profile.id,
                name: plan.name,
                quantity: plan.quantity,
                status: "need",
                source_type: "manual",
              })
              .select("id,name,quantity,status,source_type,ingredient_key,source_notes")
              .maybeSingle();
            if (data) setItems((p) => [...p, data as (typeof items)[0]]);
            setNotice(null);
          }
          setDraft({ name: "", aisle: draft.aisle, qty: "" });
        }}
      >
        <input className="tdg-planner-input" placeholder="Add item" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <select className="tdg-planner-select" value={draft.aisle} onChange={(e) => setDraft({ ...draft, aisle: e.target.value as GroceryAisle })}>
          {GROCERY_AISLES.map((a) => (
            <option key={a} value={a}>
              {AISLE_LABEL[a]}
            </option>
          ))}
        </select>
        <input className="tdg-planner-input" placeholder="Qty" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} />
        <button type="submit" className="tdg-planner-btn primary">
          Add item
        </button>
      </form>
      {items.length === 0 ? (
        <PlannerEmptyState mark="list" title="The list is empty." body="Add recipes to a meal, then come back. Or type a manual item." />
      ) : null}
      {GROCERY_AISLES.map((aisle) => {
        const rows = items.filter((it) => parseAisle(it.name).aisle === aisle);
        if (!rows.length) return null;
        return (
          <section key={aisle} className="tdg-planner-section">
            <h2>{AISLE_LABEL[aisle]}</h2>
            {rows.map((row) => (
              <div key={row.id} className={`tdg-grocery-row${row.status !== "need" ? " is-done" : ""}`}>
                <div className="tdg-grocery-check">
                  <input
                    id={`grocery-bought-${row.id}`}
                    type="checkbox"
                    aria-label={`Bought ${parseAisle(row.name).label}`}
                    checked={row.status === "bought"}
                    onChange={async (e) => {
                      const status = e.target.checked ? "bought" : "need";
                      await supabase.from("christmas_grocery_items").update({ status }).eq("id", row.id);
                      setItems((p) => p.map((x) => (x.id === row.id ? { ...x, status } : x)));
                    }}
                  />
                  <label htmlFor={`grocery-bought-${row.id}`}>
                    <strong>{parseAisle(row.name).label}</strong>
                    <em>{row.quantity || ""}</em>
                  </label>
                </div>
                <p className="tdg-grocery-sources">
                  {row.source_type === "manual" ? "Added by you" : row.source_notes ? `Needed for: ${row.source_notes}` : "From your menu"}
                </p>
                <div className="tdg-planner-actions">
                  <button
                    type="button"
                    className="tdg-planner-linkish"
                    onClick={async () => {
                      const status = row.status === "have" ? "need" : "have";
                      await supabase.from("christmas_grocery_items").update({ status }).eq("id", row.id);
                      setItems((p) => p.map((x) => (x.id === row.id ? { ...x, status } : x)));
                    }}
                  >
                    {row.status === "have" ? "Have" : "Already have"}
                  </button>
                  <input
                    className="tdg-planner-input"
                    aria-label="Quantity"
                    value={row.quantity}
                    onChange={(e) => setItems((p) => p.map((x) => (x.id === row.id ? { ...x, quantity: e.target.value } : x)))}
                    onBlur={async (e) => {
                      await supabase.from("christmas_grocery_items").update({ quantity: e.target.value.slice(0, 40) }).eq("id", row.id);
                    }}
                  />
                  {row.source_type === "manual" ? (
                    <button
                      type="button"
                      className="tdg-planner-linkish"
                      onClick={async () => {
                        await supabase.from("christmas_grocery_items").delete().eq("id", row.id);
                        setItems((p) => p.filter((x) => x.id !== row.id));
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        );
      })}
      <Link className="tdg-planner-btn" to="/account/christmas/food">
        Back to menu
      </Link>
    </div>
  );
}
