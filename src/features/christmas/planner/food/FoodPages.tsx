import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { planGroceryRegeneration } from "@/features/occasions/grocerySync";
import { CHRISTMAS_2026 } from "@/features/occasions/types";
import { trackPlannerEvent } from "../analytics";
import { detectFoodCompleteness, ingredientsFromRecipe, invalidatePlannerSnapshot } from "../intelligence";
import { hasFeature } from "../entitlements";
import { PlannerOnboarding, usePlannerBundle } from "../Onboarding";
import { PlannerPaywall } from "../Paywall";
import { GROCERY_AISLES, type GroceryAisle } from "../types";
import { PlannerComposer, PlannerEmptyState, PlannerPageHeader } from "../plannerUi";
import { applyGroceryOps } from "./persistGrocery";
import {
  filterRecipes,
  recipeAllergens,
  recipeCourse,
  recipeDifficulty,
  type RecipeCatalogRow,
  type RecipeFilters,
} from "./recipeCatalog";

const FOOD_TABS = [
  ["christmas_eve", "Christmas Eve"],
  ["christmas_day", "Christmas Day"],
  ["breakfast", "Breakfast"],
  ["parties", "Parties"],
  ["desserts", "Desserts"],
  ["drinks", "Drinks"],
  ["other", "Custom"],
] as const;

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
    supabase.from("christmas_grocery_items").select("id,name,quantity,status,source_type,meal_item_id,ingredient_key").eq("profile_id", profileId),
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
  const stored = ((groceryRes.data || []) as Array<{
    id: string;
    name: string;
    quantity: string;
    status: "have" | "need" | "bought";
    source_type: string;
    meal_item_id: string | null;
    ingredient_key?: string | null;
  }>);
  const plan = planGroceryRegeneration({ derived, stored, occasion: CHRISTMAS_2026 });
  await applyGroceryOps(profileId, plan.ops);
  invalidatePlannerSnapshot(profileId);
}

export function ChristmasPlannerFoodPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [tab, setTab] = useState<(typeof FOOD_TABS)[number][0]>("christmas_day");
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeCatalogRow[]>([]);
  const [people, setPeople] = useState(0);
  const [customTitle, setCustomTitle] = useState("");
  const [draft, setDraft] = useState({ dish: "", servings: "8", prep: "", cook: "", notes: "" });

  useEffect(() => {
    if (!profile) return;
    void Promise.all([
      supabase.from("christmas_meals").select("id,section,title,guest_count").eq("profile_id", profile.id),
      supabase.from("christmas_meal_items").select("id,dish_name,servings,prep_minutes,cook_minutes,notes,meal_id,recipe_id").eq("profile_id", profile.id),
      supabase.from("christmas_recipes").select("id,title,servings,prep_minutes,cook_minutes,category,tags,ingredients,cuisine_country,course,difficulty,dietary,allergens").eq("published", true),
      supabase.from("christmas_guests").select("adults,kids").eq("profile_id", profile.id),
    ]).then(([m, d, rec, guests]) => {
      setMeals((m.data as MealRow[]) || []);
      setDishes((d.data as DishRow[]) || []);
      setRecipes((rec.data as RecipeCatalogRow[]) || []);
      const list = (guests.data as Array<{ adults: number; kids: number }>) || [];
      setPeople(list.reduce((s, g) => s + (g.adults || 0) + (g.kids || 0), 0));
    });
    trackPlannerEvent("planner_module_opened", { module: "food", metadata: { activation: "meals" } });
  }, [profile?.id]);

  if (loading) return <p>Loading meals…</p>;
  if (!profile) return <PlannerOnboarding />;
  if (!hasFeature(access, "food_planner")) {
    return (
      <div className="tdg-planner-page">
        <PlannerPageHeader title="Meals" lede="Christmas Eve, Christmas Day, or a custom sitting — then groceries follow." />
        <PlannerPaywall feature="food_planner" title="Menus, prep times, then groceries." body="Plan Eve and Day dishes, then send ingredients to Grocery." />
      </div>
    );
  }

  const meal = meals.find((m) => m.section === tab);
  const sitting = dishes.filter((d) => d.meal_id === meal?.id);
  const totalPrep = sitting.reduce((s, d) => s + (d.prep_minutes || 0), 0);
  const totalCook = sitting.reduce((s, d) => s + (d.cook_minutes || 0), 0);
  const headcount = meal?.guest_count || people;

  async function ensureMeal() {
    if (meal) return meal;
    const title =
      tab === "other"
        ? customTitle.trim().slice(0, 120) || "Custom meal"
        : FOOD_TABS.find((t) => t[0] === tab)?.[1] || tab;
    const { data } = await supabase
      .from("christmas_meals")
      .insert({ profile_id: profile!.id, section: tab, title, guest_count: people || null })
      .select("id,section,title,guest_count")
      .maybeSingle();
    if (data) setMeals((p) => [...p, data as MealRow]);
    return data as MealRow | null;
  }

  async function setServings(dish: DishRow, servings: number) {
    const next = Math.min(50, Math.max(1, servings));
    await supabase.from("christmas_meal_items").update({ servings: next }).eq("id", dish.id);
    setDishes((p) => p.map((x) => (x.id === dish.id ? { ...x, servings: next } : x)));
    await reloadGroceryDerived(profile!.id);
  }

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Meals" lede="One sitting at a time. Change servings and the grocery list updates." />
      {headcount > 0 ? <p className="tdg-planner-muted">Planning for {headcount} people.</p> : null}
      <div className="tdg-planner-seg">
        {FOOD_TABS.map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "other" ? (
        <input
          className="tdg-planner-input"
          placeholder="Name this meal or event"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
        />
      ) : null}
      <PlannerComposer>
        <input className="tdg-planner-input" placeholder="Dish name" value={draft.dish} onChange={(e) => setDraft({ ...draft, dish: e.target.value })} />
        <input className="tdg-planner-input" type="number" placeholder="Servings" value={draft.servings} onChange={(e) => setDraft({ ...draft, servings: e.target.value })} />
        <input className="tdg-planner-input" type="number" placeholder="Prep min" value={draft.prep} onChange={(e) => setDraft({ ...draft, prep: e.target.value })} />
        <input className="tdg-planner-input" type="number" placeholder="Cook min" value={draft.cook} onChange={(e) => setDraft({ ...draft, cook: e.target.value })} />
        <div className="tdg-planner-actions">
          <button
            type="button"
            className="tdg-planner-btn primary"
            onClick={async () => {
              if (!draft.dish.trim()) return;
              const host = await ensureMeal();
              if (!host) return;
              const { data } = await supabase
                .from("christmas_meal_items")
                .insert({
                  profile_id: profile.id,
                  meal_id: host.id,
                  dish_name: draft.dish.trim().slice(0, 120),
                  servings: Math.min(50, Math.max(1, Number(draft.servings || 6))),
                  prep_minutes: draft.prep ? Number(draft.prep) : null,
                  cook_minutes: draft.cook ? Number(draft.cook) : null,
                  notes: draft.notes.slice(0, 500),
                })
                .select("id,dish_name,servings,prep_minutes,cook_minutes,notes,meal_id,recipe_id")
                .maybeSingle();
              if (data) setDishes((p) => [...p, data as DishRow]);
              setDraft({ dish: "", servings: draft.servings, prep: "", cook: "", notes: "" });
              trackPlannerEvent("planner_meal_created", { module: "food" });
            }}
          >
            Add dish
          </button>
          <Link className="tdg-planner-btn" to="/account/christmas/recipes">
            Browse recipes
          </Link>
        </div>
      </PlannerComposer>
      {sitting.length === 0 ? (
        <PlannerEmptyState
          mark="food"
          title="This sitting is empty."
          body="Add a dish or pick a recipe. Servings can follow your guest count."
        />
      ) : (
        <p className="tdg-planner-muted">
          {sitting.length} dish{sitting.length === 1 ? "" : "es"} · prep {totalPrep}m · cook {totalCook}m
        </p>
      )}
      {sitting.map((d) => (
        <div key={d.id} className="tdg-planner-row">
          <div>
            <strong>{d.dish_name}</strong>
            <div className="tdg-planner-muted">
              {d.servings} servings
              {d.prep_minutes ? ` · prep ${d.prep_minutes}m` : ""}
              {d.cook_minutes ? ` · cook ${d.cook_minutes}m` : ""}
            </div>
          </div>
          <div className="tdg-planner-actions">
            <label className="tdg-planner-muted">
              Servings
              <input
                className="tdg-planner-input"
                type="number"
                min={1}
                max={50}
                value={d.servings}
                onChange={(e) => void setServings(d, Number(e.target.value || d.servings))}
                style={{ width: 72, marginLeft: 8 }}
              />
            </label>
            {headcount > 0 && d.servings !== headcount ? (
              <button type="button" className="tdg-planner-btn" onClick={() => void setServings(d, headcount)}>
                Scale to {headcount}
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {meal ? (
        <p className="tdg-planner-muted">
          {detectFoodCompleteness({
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
          })
            .filter((row) => row.mealId === meal.id)
            .map((row) => (row.missing.length ? `Menu missing: ${row.missing.join(", ")}.` : `${row.title} looks complete.`))}
        </p>
      ) : null}
      <Link className="tdg-planner-btn primary" to="/account/christmas/grocery">
        Open grocery list
      </Link>
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

  useEffect(() => {
    void supabase
      .from("christmas_recipes")
      .select("id,slug,title,description,teaser,entitlement_key,category,prep_minutes,cook_minutes,servings,image_path,ingredients,steps,tags,cuisine_country,cuisine_region,course,difficulty,dietary,allergens")
      .eq("published", true)
      .then(({ data }) => setRecipes((data as RecipeCatalogRow[]) || []));
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

  if (loading) return <p>Loading recipes…</p>;
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
    const plan = planGroceryRegeneration({
      derived,
      stored: (stored || []) as never,
      occasion: CHRISTMAS_2026,
    });
    const inserts = plan.ops.filter((op) => op.op === "insert");
    const updates = plan.ops.filter((op) => op.op === "update");
    await applyGroceryOps(profile!.id, [...inserts, ...updates]);
  }

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Recipes" lede="Search original TDG dishes. Scale servings, save, add to a menu, or send ingredients to grocery." />
      <input
        className="tdg-planner-input"
        placeholder="Search recipes"
        value={filters.query || ""}
        onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
      />
      <div className="tdg-recipe-filters">
        {[
          ["course", ["all", "main", "side", "dessert", "drink", "breakfast"]],
          ["dietary", ["all", "vegetarian", "vegan", "gluten-free"]],
          ["difficulty", ["all", "easy", "medium", "advanced"]],
          ["country", ["all", "international"]],
        ].map(([key, options]) => (
          <label key={String(key)}>
            {String(key)}
            <select
              className="tdg-planner-select"
              value={String((filters as Record<string, unknown>)[String(key)] || "all")}
              onChange={(e) => setFilters((p) => ({ ...p, [String(key)]: e.target.value }))}
            >
              {(options as string[]).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Max prep
          <select
            className="tdg-planner-select"
            value={String(filters.maxPrepMinutes ?? "all")}
            onChange={(e) =>
              setFilters((p) => ({ ...p, maxPrepMinutes: e.target.value === "all" ? null : Number(e.target.value) }))
            }
          >
            <option value="all">Any</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="60">60 min</option>
          </select>
        </label>
        <label>
          Allergen hide
          <select
            className="tdg-planner-select"
            value={filters.allergen || "all"}
            onChange={(e) => setFilters((p) => ({ ...p, allergen: e.target.value }))}
          >
            <option value="all">None</option>
            <option value="nuts">Nuts</option>
            <option value="dairy">Dairy</option>
            <option value="eggs">Eggs</option>
            <option value="gluten">Gluten</option>
          </select>
        </label>
      </div>
      {visible.length === 0 ? (
        <PlannerEmptyState mark="food" title="No recipes match." body="Clear a filter, or try All." />
      ) : null}
      {visible.map((r) => {
        const locked = r.entitlement_key !== "free" && !r.teaser && !canAll;
        const serve = servings[r.id] || r.servings;
        const open = openId === r.id;
        return (
          <article key={r.id} className="tdg-planner-card tdg-recipe-card">
            <button type="button" className="tdg-recipe-open" onClick={() => setOpenId(open ? null : r.id)}>
              <strong>{r.title}</strong>
              <p className="tdg-planner-muted">
                {recipeCourse(r)} · {recipeDifficulty(r)} · prep {r.prep_minutes}m · cook {r.cook_minutes}m
              </p>
            </button>
            <p>{r.description}</p>
            {open ? (
              <div className="tdg-recipe-detail">
                <ol>
                  {(Array.isArray(r.steps) ? r.steps : []).map((step, i) => (
                    <li key={i}>{String(step)}</li>
                  ))}
                </ol>
                <p className="tdg-planner-muted">Allergens noted from ingredients: {recipeAllergens(r).join(", ") || "none listed"}</p>
              </div>
            ) : null}
            {locked ? (
              <PlannerPaywall feature="recipes" title="Full recipe pack" body="Save recipes, add them to meals, and roll ingredients into groceries." />
            ) : (
              <div className="tdg-planner-actions">
                <label>
                  Servings
                  <input
                    className="tdg-planner-input"
                    type="number"
                    min={1}
                    max={50}
                    value={serve}
                    onChange={(e) => setServings((p) => ({ ...p, [r.id]: Math.min(50, Math.max(1, Number(e.target.value || r.servings))) }))}
                    style={{ width: 72, marginLeft: 8 }}
                  />
                </label>
                <button
                  type="button"
                  className="tdg-planner-btn"
                  onClick={async () => {
                    await supabase.from("christmas_recipe_saves").insert({ profile_id: profile.id, recipe_id: r.id });
                    setSaved((p) => new Set([...p, r.id]));
                    trackPlannerEvent("planner_recipe_saved", { module: "recipes" });
                  }}
                >
                  {saved.has(r.id) ? "Saved" : "Save"}
                </button>
                <button type="button" className="tdg-planner-btn" onClick={() => void addToMeal(r, "christmas_eve")}>
                  Add to Eve
                </button>
                <button type="button" className="tdg-planner-btn" onClick={() => void addToMeal(r, "christmas_day")}>
                  Add to Day
                </button>
                <button type="button" className="tdg-planner-btn" onClick={() => void addIngredients(r)}>
                  Add to grocery
                </button>
              </div>
            )}
          </article>
        );
      })}
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
    Array<{ id: string; name: string; quantity: string; status: string; source_type: string; ingredient_key?: string | null }>
  >([]);
  const [draft, setDraft] = useState({ name: "", aisle: "other" as GroceryAisle, qty: "" });

  async function reload() {
    if (!profile) return;
    const { data } = await supabase
      .from("christmas_grocery_items")
      .select("id,name,quantity,status,source_type,ingredient_key")
      .eq("profile_id", profile.id);
    setItems((data as typeof items) || []);
  }

  useEffect(() => {
    if (!profile) return;
    void reload();
    trackPlannerEvent("planner_module_opened", { module: "grocery", metadata: { activation: "grocery" } });
  }, [profile?.id]);

  if (loading) return <p>Loading grocery…</p>;
  if (!profile) return <PlannerOnboarding />;
  if (!hasFeature(access, "food_planner")) {
    return (
      <div className="tdg-planner-page">
        <PlannerPageHeader title="Grocery" lede="One list from meals, extras, and the shops you still need." />
        <PlannerPaywall feature="food_planner" title="Grocery lives with the food planner." body="Unlock meals to keep one grocery list for Christmas." />
      </div>
    );
  }

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Grocery" lede="Built from your menus. Tick what you have. Manual extras stay put when the list regenerates." />
      <div className="tdg-planner-actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="tdg-planner-btn primary"
          onClick={async () => {
            await reloadGroceryDerived(profile.id);
            await reload();
          }}
        >
          Refresh from meals
        </button>
        <Link className="tdg-planner-btn" to="/account/christmas/food">
          Edit meals
        </Link>
      </div>
      <PlannerComposer>
        <form
          onSubmit={async (event: FormEvent) => {
            event.preventDefault();
            if (!draft.name.trim()) return;
            const { data } = await supabase
              .from("christmas_grocery_items")
              .insert({
                profile_id: profile.id,
                name: `${draft.aisle}|${draft.name.trim()}`.slice(0, 120),
                quantity: draft.qty.slice(0, 40),
                status: "need",
                source_type: "manual",
              })
              .select("id,name,quantity,status,source_type,ingredient_key")
              .maybeSingle();
            if (data) setItems((p) => [...p, data as (typeof items)[0]]);
            setDraft({ name: "", aisle: draft.aisle, qty: "" });
          }}
        >
          <input className="tdg-planner-input" placeholder="Manual item" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <select className="tdg-planner-select" value={draft.aisle} onChange={(e) => setDraft({ ...draft, aisle: e.target.value as GroceryAisle })}>
            {GROCERY_AISLES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input className="tdg-planner-input" placeholder="Qty" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} />
          <button type="submit" className="tdg-planner-btn primary">
            Add item
          </button>
        </form>
      </PlannerComposer>
      {items.length === 0 ? (
        <PlannerEmptyState mark="list" title="The list is empty." body="Add a recipe to a meal, then refresh. Or type a manual item." />
      ) : null}
      {GROCERY_AISLES.map((aisle) => {
        const rows = items.filter((it) => parseAisle(it.name).aisle === aisle);
        if (!rows.length) return null;
        return (
          <section key={aisle} className="tdg-planner-section">
            <h2>{aisle}</h2>
            {rows.map((row) => (
              <label key={row.id} className="tdg-planner-row">
                <div>
                  <strong>{parseAisle(row.name).label}</strong>
                  <div className="tdg-planner-muted">
                    {row.quantity || "qty unset"}
                    {row.source_type === "manual" ? " · added by you" : " · from recipes"}
                    {row.status === "have" ? " · already have" : ""}
                  </div>
                </div>
                <span className="tdg-grocery-checks">
                  <input
                    type="checkbox"
                    aria-label="Need / bought"
                    checked={row.status === "bought"}
                    onChange={async (e) => {
                      const status = e.target.checked ? "bought" : "need";
                      await supabase.from("christmas_grocery_items").update({ status }).eq("id", row.id);
                      setItems((p) => p.map((x) => (x.id === row.id ? { ...x, status } : x)));
                    }}
                  />
                  <button
                    type="button"
                    className="tdg-planner-linkish"
                    onClick={async () => {
                      const status = row.status === "have" ? "need" : "have";
                      await supabase.from("christmas_grocery_items").update({ status }).eq("id", row.id);
                      setItems((p) => p.map((x) => (x.id === row.id ? { ...x, status } : x)));
                    }}
                  >
                    {row.status === "have" ? "Have" : "Mark have"}
                  </button>
                </span>
              </label>
            ))}
          </section>
        );
      })}
    </div>
  );
}
