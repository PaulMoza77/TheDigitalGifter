import { useEffect, useMemo, useState } from "react";
import { Bookmark, Clock, Sparkles, Users, UtensilsCrossed, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { trackPlannerEvent } from "../analytics";
import { detectFoodCompleteness } from "../intelligence";
import { hasFeature } from "../entitlements";
import { PlannerOnboarding, usePlannerBundle } from "../Onboarding";
import { PlannerPaywall } from "../Paywall";
import { PlannerEmptyState, PlannerErrorState, PlannerLoading } from "../plannerUi";
import { bumpPlannerWorkspace } from "../workspaceSync";
import { copilotEnabled } from "../copilot/ask";
import { useCopilotUi } from "../copilot/CopilotHost";
import { reloadGroceryDerived, RECIPE_SELECT } from "./foodOps";
import {
  DIET_CHIPS,
  FOOD_TABS,
  MEAL_HERO_SRC,
  MENU_COURSES,
  coursePhoto,
  dietFromGuestNotes,
  readStoredDiet,
  recipePhoto,
  sittingForTab,
  suggestInputFromDiet,
  writeStoredDiet,
  type DietChipId,
  type MealTab,
  type MenuCourseId,
} from "./mealVisuals";
import {
  filterRecipes,
  formatMinutes,
  pickIdeasForTable,
  recipeCourse,
  recipeDifficulty,
  suggestMenu,
  type RecipeCatalogRow,
} from "./recipeCatalog";

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

export function ChristmasPlannerFoodPage() {
  const copilot = useCopilotUi();
  const { loading, access, profile } = usePlannerBundle();
  const [tab, setTab] = useState<MealTab>("christmas_day");
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeCatalogRow[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [people, setPeople] = useState(8);
  const [diet, setDiet] = useState<DietChipId>("all");
  const [customTitle, setCustomTitle] = useState("");
  const [pickerCourse, setPickerCourse] = useState<MenuCourseId | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const stored = readStoredDiet(profile.id);
    if (stored) setDiet(stored);
    void Promise.all([
      supabase.from("christmas_meals").select("id,section,title,guest_count").eq("profile_id", profile.id),
      supabase.from("christmas_meal_items").select("id,dish_name,servings,prep_minutes,cook_minutes,notes,meal_id,recipe_id").eq("profile_id", profile.id),
      supabase.from("christmas_recipes").select(RECIPE_SELECT).eq("published", true),
      supabase.from("christmas_guests").select("adults,kids,dietary").eq("profile_id", profile.id),
      supabase.from("christmas_recipe_saves").select("recipe_id").eq("profile_id", profile.id),
    ]).then(([m, d, rec, guests, saves]) => {
      if (m.error || d.error || rec.error) {
        setLoadError("We couldn’t load your meals just now. Try again in a moment.");
      } else {
        setLoadError(null);
      }
      setMeals((m.data as MealRow[]) || []);
      setDishes((d.data as DishRow[]) || []);
      setRecipes((rec.data as RecipeCatalogRow[]) || []);
      const list = (guests.data as Array<{ adults: number; kids: number; dietary?: string }>) || [];
      const n = list.reduce((s, g) => s + (g.adults || 0) + (g.kids || 0), 0);
      if (n) setPeople(n);
      if (!stored) {
        const fromGuests = dietFromGuestNotes(list.map((g) => g.dietary || ""));
        if (fromGuests !== "all") setDiet(fromGuests);
      }
      setSaved(new Set(((saves.data as Array<{ recipe_id: string }>) || []).map((r) => r.recipe_id)));
    });
    trackPlannerEvent("planner_module_opened", { module: "food", metadata: { activation: "meals" } });
  }, [profile?.id]);

  const meal = meals.find((row) => row.section === tab);
  const sitting = dishes.filter((d) => d.meal_id === meal?.id);
  const headcount = people;
  const occasionLabel = FOOD_TABS.find((t) => t[0] === tab)?.[1] || "Christmas Day";
  const dietHint = suggestInputFromDiet(diet);

  const byCourse = (course: MenuCourseId) =>
    sitting.filter((d) => {
      const recipe = recipes.find((r) => r.id === d.recipe_id);
      if (recipe) return recipeCourse(recipe) === course;
      return course === "main";
    });

  const filledCourses = MENU_COURSES.filter((course) => byCourse(course.id).length > 0).length;
  const ideas = useMemo(
    () =>
      pickIdeasForTable(recipes, {
        dietary: dietHint.dietary,
        allergen: dietHint.allergen,
        excludeIds: new Set(sitting.map((d) => d.recipe_id).filter(Boolean) as string[]),
      }),
    [recipes, dietHint.dietary, dietHint.allergen, sitting],
  );

  if (loading) return <PlannerLoading label="Loading meals…" />;
  if (!profile) return <PlannerOnboarding />;
  if (!hasFeature(access, "food_planner")) {
    return (
      <div className="tdg-planner-page tdg-meals">
        <header className="tdg-meals-page-head">
          <h1>Meals</h1>
          <p>Plan every festive table, from breakfast to the big Christmas dinner.</p>
        </header>
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
    const title = tab === "other" ? customTitle.trim().slice(0, 120) || "Custom meal" : FOOD_TABS.find((t) => t[0] === tab)?.[1] || tab;
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

  async function removeDish(dish: DishRow) {
    await supabase.from("christmas_meal_items").delete().eq("id", dish.id);
    setDishes((p) => p.filter((x) => x.id !== dish.id));
    await reloadGroceryDerived(profile!.id);
    bumpPlannerWorkspace();
  }

  async function saveRecipe(recipe: RecipeCatalogRow) {
    if (saved.has(recipe.id)) return;
    const { error } = await supabase.from("christmas_recipe_saves").insert({ profile_id: profile!.id, recipe_id: recipe.id });
    if (!error) {
      setSaved((p) => new Set([...p, recipe.id]));
      trackPlannerEvent("planner_recipe_saved", { module: "food" });
    }
  }

  async function buildMenu() {
    if (busy) return;
    setBusy(true);
    try {
      await ensureMeal(people);
      const suggested = suggestMenu(recipes, {
        guests: people,
        dietary: dietHint.dietary,
        allergen: dietHint.allergen,
        sitting: sittingForTab(tab),
      });
      const already = new Set(sitting.map((d) => d.recipe_id));
      for (const recipe of suggested) {
        if (already.has(recipe.id)) continue;
        already.add(recipe.id);
        await addRecipeToSitting(recipe);
      }
      document.getElementById("meals-menu")?.scrollIntoView({ block: "start", behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  function setDietChip(next: DietChipId) {
    setDiet(next);
    if (profile) writeStoredDiet(profile.id, next);
  }

  function openCopilotDraft() {
    const prompt = `Create a dinner plan for ${headcount}.`;
    copilot?.openCopilot(prompt, "meals");
  }

  async function suggestFullMenu() {
    await buildMenu();
    openCopilotDraft();
  }

  const pickerRecipes = pickerCourse
    ? filterRecipes(recipes, {
        query: pickerQuery,
        course: pickerCourse,
        dietary: dietHint.dietary,
        allergen: dietHint.allergen,
      })
    : [];

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

  return (
    <div className="tdg-planner-page tdg-meals">
      <header className="tdg-meals-page-head">
        <h1>Meals</h1>
        <p>Plan every festive table, from breakfast to the big Christmas dinner.</p>
      </header>

      <section className="tdg-meals-hero" aria-label="Christmas feast">
        <img src={MEAL_HERO_SRC} alt="" decoding="async" />
        <div className="tdg-meals-hero-veil" />
        <div className="tdg-meals-hero-copy">
          <p className="tdg-meals-hero-kicker">Your Christmas feast</p>
          <h2>A beautiful menu, planned around your people.</h2>
          <div className="tdg-meals-hero-badges">
            <span>{occasionLabel}</span>
            <span>
              {headcount} {headcount === 1 ? "guest" : "guests"}
            </span>
          </div>
          <button type="button" className="tdg-planner-btn primary tdg-meals-hero-cta" disabled={busy} onClick={() => void buildMenu()}>
            Build my menu
          </button>
        </div>
      </section>

      <div className="tdg-meals-summary">
        <div>
          <Users size={22} strokeWidth={1.6} aria-hidden />
          <label className="tdg-meals-guests-edit">
            <span className="tdg-planner-sr">Guests</span>
            <input
              className="tdg-planner-input"
              type="number"
              min={1}
              max={50}
              value={people}
              onChange={(e) => setPeople(Math.min(50, Math.max(1, Number(e.target.value || 1))))}
              onBlur={() => {
                if (meal) void ensureMeal(people);
              }}
            />
          </label>
          <span>Guests</span>
        </div>
        <div>
          <UtensilsCrossed size={22} strokeWidth={1.6} aria-hidden />
          <strong>
            {filledCourses} / {MENU_COURSES.length}
          </strong>
          <span>Courses</span>
        </div>
        <div>
          <Bookmark size={22} strokeWidth={1.6} aria-hidden />
          <strong>{saved.size}</strong>
          <span>Recipes saved</span>
        </div>
        <div>
          <Wallet size={22} strokeWidth={1.6} aria-hidden />
          <strong>Not calculated</strong>
          <span>Estimated cost</span>
        </div>
      </div>

      {loadError ? (
        <PlannerErrorState title="Meals didn’t load." body={loadError} />
      ) : null}

      <section className="tdg-meals-menu" id="meals-menu">
        <div className="tdg-meals-menu-head">
          <h2>Your Christmas menu</h2>
          <Link className="tdg-meals-grocery" to="/account/christmas/grocery">
            Open grocery →
          </Link>
        </div>
        <div className="tdg-meals-tabs" role="tablist" aria-label="Meal occasions">
          {FOOD_TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === "other" ? (
          <input
            className="tdg-planner-input tdg-meals-custom"
            placeholder="Name this meal"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            aria-label="Custom meal name"
          />
        ) : null}
        <div className="tdg-meals-courses">
          {MENU_COURSES.map((course) => {
            const rows = byCourse(course.id);
            const primary = rows[0] || null;
            const recipe = primary ? recipes.find((r) => r.id === primary.recipe_id) : null;
            return (
              <article key={course.id} className={`tdg-meals-course${primary ? " has-dish" : ""}`} data-course={course.id}>
                <button type="button" className="tdg-meals-course-visual" onClick={() => setPickerCourse(course.id)}>
                  <img src={recipe ? recipePhoto(recipe, course.id) : coursePhoto(course.id)} alt="" />
                </button>
                <div className="tdg-meals-course-body">
                  <p className="tdg-meals-course-label">{course.label}</p>
                  {primary ? (
                    <>
                      <strong>{primary.dish_name}</strong>
                      <p className="tdg-planner-muted">
                        {primary.prep_minutes || primary.cook_minutes
                          ? formatMinutes((primary.prep_minutes || 0) + (primary.cook_minutes || 0))
                          : recipe
                            ? recipeDifficulty(recipe)
                            : "On the menu"}
                        {rows.length > 1 ? ` · +${rows.length - 1} more` : ""}
                      </p>
                      <label className="tdg-servings-inline">
                        Servings
                        <input
                          className="tdg-planner-input"
                          type="number"
                          min={1}
                          max={50}
                          value={primary.servings}
                          onChange={(e) => void setServings(primary, Number(e.target.value || primary.servings))}
                        />
                      </label>
                      <div className="tdg-meals-course-actions">
                        <button type="button" className="tdg-planner-linkish" onClick={() => setPickerCourse(course.id)}>
                          Change
                        </button>
                        <button type="button" className="tdg-planner-linkish" onClick={() => void removeDish(primary)}>
                          Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>Not chosen yet</strong>
                      <p className="tdg-planner-muted">{course.empty}</p>
                      <button type="button" className="tdg-planner-btn" onClick={() => setPickerCourse(course.id)}>
                        Choose {course.label.toLowerCase()}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {completeness?.missing.length ? (
          <p className="tdg-planner-muted tdg-meals-gap">Menu still needs {completeness.missing.join(", ")}.</p>
        ) : sitting.length ? (
          <p className="tdg-planner-muted tdg-meals-gap">Menu looks complete for this sitting.</p>
        ) : null}
      </section>

      <section className="tdg-meals-ideas">
        <div className="tdg-meals-ideas-head">
          <h2>Ideas picked for your table</h2>
          <Link to="/account/christmas/recipes">View all recipes</Link>
        </div>
        {ideas.length === 0 ? (
          <PlannerEmptyState
            mark="food"
            title="No recipe ideas yet."
            body="When the catalogue loads, we’ll pick three real dishes for this table."
            action={
              <Link className="tdg-planner-btn" to="/account/christmas/recipes">
                View all recipes
              </Link>
            }
          />
        ) : (
          <div className="tdg-meals-ideas-grid">
            {ideas.map((recipe) => (
              <article key={recipe.id} className="tdg-meals-idea">
                <div className="tdg-meals-idea-visual">
                  <img src={recipePhoto(recipe)} alt="" />
                </div>
                <div className="tdg-meals-idea-body">
                  <strong>{recipe.title}</strong>
                  <p>{recipe.description}</p>
                  <p className="tdg-meals-idea-meta">
                    <Clock size={14} strokeWidth={1.8} aria-hidden />
                    {formatMinutes((recipe.prep_minutes || 0) + (recipe.cook_minutes || 0))}
                    <span aria-hidden>·</span>
                    {recipeDifficulty(recipe)}
                  </p>
                  <div className="tdg-meals-idea-actions">
                    <button type="button" className="tdg-planner-btn" onClick={() => void addRecipeToSitting(recipe)}>
                      Add to menu
                    </button>
                    <button
                      type="button"
                      className="tdg-planner-btn ghost"
                      disabled={saved.has(recipe.id)}
                      onClick={() => void saveRecipe(recipe)}
                    >
                      <Bookmark size={16} strokeWidth={1.8} aria-hidden />
                      {saved.has(recipe.id) ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="tdg-meals-diet" aria-label="Dietary notes">
        <div className="tdg-meals-diet-head">
          <h2>Dietary notes</h2>
          <Link to="/account/christmas/hosting">Manage guests</Link>
        </div>
        <div className="tdg-meals-chips" role="group">
          {DIET_CHIPS.map((chip) => (
            <button key={chip.id} type="button" className={diet === chip.id ? "on" : ""} onClick={() => setDietChip(chip.id)}>
              {chip.label}
            </button>
          ))}
        </div>
        <p className="tdg-planner-muted">
          These filters shape menu suggestions and recipe ideas. Guest notes stay on Hosting — they are not a separate meals database.
        </p>
      </section>

      <aside className="tdg-meals-copilot-cta">
        <p className="tdg-planner-kicker">Christmas Copilot</p>
        <h2>Let Christmas Copilot create the first draft</h2>
        <p>Tell us your preferences and we’ll build a balanced menu.</p>
        <button
          type="button"
          className="tdg-planner-btn primary"
          disabled={!copilotEnabled()}
          onClick={() => void suggestFullMenu()}
        >
          <Sparkles size={16} strokeWidth={1.8} aria-hidden />
          Suggest my full menu
        </button>
      </aside>

      {pickerCourse ? (
        <div className="tdg-planner-sheet" role="dialog" aria-modal="true" aria-labelledby="meal-pick-title">
          <button type="button" className="tdg-planner-sheet-backdrop" aria-label="Close recipe picker" onClick={() => setPickerCourse(null)} />
          <div className="tdg-planner-sheet-card tdg-meals-picker">
            <div className="tdg-planner-sheet-head">
              <h2 id="meal-pick-title">Choose {MENU_COURSES.find((c) => c.id === pickerCourse)?.label.toLowerCase()}</h2>
              <button type="button" className="tdg-planner-btn ghost" onClick={() => setPickerCourse(null)}>
                Close
              </button>
            </div>
            <input
              className="tdg-planner-input"
              placeholder="Search recipes..."
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              aria-label="Search recipes"
            />
            {pickerRecipes.length === 0 ? (
              <PlannerEmptyState mark="food" title="No recipes match." body="Clear the search or open the full recipe catalogue." />
            ) : (
              <ul className="tdg-meals-picker-list">
                {pickerRecipes.slice(0, 24).map((recipe) => (
                  <li key={recipe.id}>
                    <button
                      type="button"
                      className="tdg-meals-picker-row"
                      onClick={async () => {
                        await addRecipeToSitting(recipe);
                        setPickerCourse(null);
                        setPickerQuery("");
                      }}
                    >
                      <img src={recipePhoto(recipe, pickerCourse)} alt="" />
                      <span>
                        <strong>{recipe.title}</strong>
                        <em>
                          {formatMinutes((recipe.prep_minutes || 0) + (recipe.cook_minutes || 0))} · {recipeDifficulty(recipe)}
                        </em>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link className="tdg-planner-btn" to="/account/christmas/recipes">
              View all recipes
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
