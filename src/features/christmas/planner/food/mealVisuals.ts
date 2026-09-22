import { recipeCourse, type RecipeCatalogRow } from "./recipeCatalog";

export const MEAL_HERO_SRC = "/christmas/planner/dinner-table.webp";

export const FOOD_TABS = [
  ["christmas_eve", "Christmas Eve"],
  ["christmas_day", "Christmas Day"],
  ["breakfast", "Christmas Breakfast"],
  ["other", "Custom meal"],
] as const;

export type MealTab = (typeof FOOD_TABS)[number][0];

export const MENU_COURSES = [
  { id: "appetizer", label: "Starter", empty: "Choose a starter for this table." },
  { id: "main", label: "Main", empty: "Choose the centrepiece." },
  { id: "side", label: "Sides", empty: "Add a side to round it out." },
  { id: "dessert", label: "Dessert", empty: "Save something sweet for last." },
] as const;

export type MenuCourseId = (typeof MENU_COURSES)[number]["id"];

export const DIET_CHIPS = [
  { id: "all", label: "No restrictions" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "gluten-free", label: "Gluten-free" },
  { id: "nut-free", label: "Nut-free" },
] as const;

export type DietChipId = (typeof DIET_CHIPS)[number]["id"];

const COURSE_PHOTOS: Record<MenuCourseId, string> = {
  appetizer: MEAL_HERO_SRC,
  main: MEAL_HERO_SRC,
  side: MEAL_HERO_SRC,
  dessert: "/assets/christmas/library-stills/prague_bakery_window.jpg",
};

export function coursePhoto(course: MenuCourseId): string {
  return COURSE_PHOTOS[course];
}

export function recipePhoto(recipe: Pick<RecipeCatalogRow, "id" | "image_path" | "course" | "category"> | null | undefined, course?: MenuCourseId): string {
  const raw = String(recipe?.image_path || "").trim();
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  if (course) return COURSE_PHOTOS[course];
  const inferred = recipe ? recipeCourse(recipe as RecipeCatalogRow) : "";
  if (inferred === "appetizer" || inferred === "main" || inferred === "side" || inferred === "dessert") {
    return COURSE_PHOTOS[inferred];
  }
  return MEAL_HERO_SRC;
}

export function dietStorageKey(profileId: string): string {
  return `tdg-planner-meals-diet:${profileId}`;
}

export function readStoredDiet(profileId: string): DietChipId | null {
  try {
    const raw = window.localStorage.getItem(dietStorageKey(profileId));
    if (DIET_CHIPS.some((chip) => chip.id === raw)) return raw as DietChipId;
  } catch {
    /* ignore private mode */
  }
  return null;
}

export function writeStoredDiet(profileId: string, diet: DietChipId) {
  try {
    window.localStorage.setItem(dietStorageKey(profileId), diet);
  } catch {
    /* ignore private mode */
  }
}

export function dietFromGuestNotes(notes: string[]): DietChipId {
  const blob = notes.map((n) => n.toLowerCase()).filter(Boolean);
  if (!blob.length) return "all";
  const hit = (needle: string) => blob.some((n) => n.includes(needle));
  if (blob.every((n) => n.includes("vegetarian") || n.includes("vegan"))) return "vegetarian";
  if (blob.every((n) => n.includes("gluten"))) return "gluten-free";
  if (blob.every((n) => n.includes("nut"))) return "nut-free";
  if (hit("vegetarian") && !hit("gluten") && !hit("nut")) return "vegetarian";
  if (hit("gluten") && !hit("vegetarian") && !hit("nut")) return "gluten-free";
  if (hit("nut") && !hit("vegetarian") && !hit("gluten")) return "nut-free";
  return "all";
}

export function sittingForTab(tab: MealTab): "christmas_eve" | "christmas_day" | "breakfast" | "custom" {
  if (tab === "breakfast") return "breakfast";
  if (tab === "christmas_eve") return "christmas_eve";
  if (tab === "other") return "custom";
  return "christmas_day";
}

export function suggestInputFromDiet(diet: DietChipId): { dietary: string; allergen?: string } {
  if (diet === "nut-free") return { dietary: "all", allergen: "nuts" };
  if (diet === "all") return { dietary: "all" };
  return { dietary: diet };
}
