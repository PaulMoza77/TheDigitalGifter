import type { PlannerFeatureKey } from "../types";
import { PLANNER_MODULE_PHOTOS, type PlannerPhotoSlot } from "./modulePhotos";

export type PlannerModuleId =
  | "gifts"
  | "meals"
  | "budget"
  | "calendar"
  | "recipes"
  | "hosting"
  | "travel"
  | "traditions"
  | "cards"
  | "plan"
  | "shopping"
  | "today"
  | "home"
  | "memories";

export type PlannerModuleDef = {
  id: PlannerModuleId;
  title: string;
  tagline: string;
  href: string;
  feature?: PlannerFeatureKey;
  photo?: PlannerPhotoSlot;
  searchTerms: string[];
};

export const HOME_GRID_MODULES: PlannerModuleDef[] = [
  {
    id: "gifts",
    title: "Gifts",
    tagline: "Find the perfect gifts",
    href: "/account/christmas/gifts",
    photo: PLANNER_MODULE_PHOTOS.gifts,
    searchTerms: ["gifts", "presents", "people", "wishlist"],
  },
  {
    id: "meals",
    title: "Meals",
    tagline: "Plan, cook, enjoy",
    href: "/account/christmas/food",
    feature: "food_planner",
    photo: PLANNER_MODULE_PHOTOS.meals,
    searchTerms: ["meals", "food", "dinner", "menu"],
  },
  {
    id: "budget",
    title: "Budget",
    tagline: "Keep track & save",
    href: "/account/christmas/budget",
    feature: "budget",
    photo: PLANNER_MODULE_PHOTOS.budget,
    searchTerms: ["budget", "spend", "money"],
  },
  {
    id: "calendar",
    title: "Calendar",
    tagline: "Plan every moment",
    href: "/account/christmas/calendar",
    photo: PLANNER_MODULE_PHOTOS.calendar,
    searchTerms: ["calendar", "dates", "events"],
  },
  {
    id: "recipes",
    title: "Recipes",
    tagline: "Save seasonal dishes",
    href: "/account/christmas/recipes",
    feature: "recipes",
    photo: PLANNER_MODULE_PHOTOS.recipes,
    searchTerms: ["recipes", "cooking", "dishes"],
  },
  {
    id: "hosting",
    title: "Home & Hosting",
    tagline: "Decorate, prepare, celebrate",
    href: "/account/christmas/hosting",
    feature: "hosting",
    photo: PLANNER_MODULE_PHOTOS.hosting,
    searchTerms: ["hosting", "home", "guests", "decorate"],
  },
  {
    id: "travel",
    title: "Travel",
    tagline: "Trips, stays & experiences",
    href: "/account/christmas/travel",
    feature: "travel",
    photo: PLANNER_MODULE_PHOTOS.travel,
    searchTerms: ["travel", "trips", "packing"],
  },
  {
    id: "traditions",
    title: "Traditions",
    tagline: "Create lasting memories",
    href: "/account/christmas/traditions",
    photo: PLANNER_MODULE_PHOTOS.traditions,
    searchTerms: ["traditions", "family", "memories"],
  },
  {
    id: "cards",
    title: "Cards",
    tagline: "Send love this season",
    href: "/account/christmas/cards",
    photo: PLANNER_MODULE_PHOTOS.cards,
    searchTerms: ["cards", "greetings", "messages"],
  },
];

export const SIDEBAR_PRIMARY = [
  { to: "/account/christmas", label: "Home", end: true as const, id: "home" },
  { to: "/account/christmas/today", label: "Today", id: "today" },
  { to: "/account/christmas/plan", label: "Plan", id: "plan" },
  { to: "/account/christmas/gifts", label: "Gifts", id: "gifts" },
  { to: "/account/christmas/food", label: "Meals", id: "meals" },
  { to: "/account/christmas/recipes", label: "Recipes", id: "recipes" },
  { to: "/account/christmas/shopping", label: "Shopping", id: "shopping" },
] as const;

export const SIDEBAR_MORE = [
  { to: "/account/christmas/budget", label: "Budget" },
  { to: "/account/christmas/calendar", label: "Calendar" },
  { to: "/account/christmas/hosting", label: "Home & Hosting" },
  { to: "/account/christmas/home", label: "Home prep" },
  { to: "/account/christmas/travel", label: "Travel" },
  { to: "/account/christmas/traditions", label: "Traditions" },
  { to: "/account/christmas/cards", label: "Cards" },
  { to: "/account/christmas/memories", label: "Memories" },
] as const;

export const MOBILE_NAV = [
  { to: "/account/christmas", label: "Home", end: true as const, id: "home" },
  { to: "/account/christmas/plan", label: "Plan", id: "plan" },
  { to: "copilot", label: "AI Copilot", id: "copilot" },
  { to: "/account/christmas/shopping", label: "Shopping", id: "shopping" },
  { to: "/account/christmas/more", label: "More", id: "more" },
] as const;

export const SEARCHABLE_MODULES: PlannerModuleDef[] = [
  ...HOME_GRID_MODULES,
  {
    id: "plan",
    title: "Plan",
    tagline: "Your Christmas tasks",
    href: "/account/christmas/plan",
    searchTerms: ["plan", "tasks", "today"],
  },
  {
    id: "shopping",
    title: "Shopping",
    tagline: "To buy, ordered, arriving",
    href: "/account/christmas/shopping",
    searchTerms: ["shopping", "grocery", "orders"],
  },
  {
    id: "today",
    title: "Today",
    tagline: "What to do next",
    href: "/account/christmas/today",
    searchTerms: ["today", "priorities", "next"],
  },
  {
    id: "home",
    title: "Home prep",
    tagline: "Tree, rooms and lights",
    href: "/account/christmas/home",
    searchTerms: ["tree", "rooms", "lights", "home prep"],
  },
  {
    id: "memories",
    title: "Memories",
    tagline: "Keep the season",
    href: "/account/christmas/memories",
    searchTerms: ["memories", "photos"],
  },
];

export function searchPlannerModules(query: string): PlannerModuleDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SEARCHABLE_MODULES.filter((mod) => {
    const hay = [mod.title, mod.tagline, ...mod.searchTerms].join(" ").toLowerCase();
    return hay.includes(q);
  }).slice(0, 6);
}

export function moreRouteActive(pathname: string): boolean {
  return SIDEBAR_MORE.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
}
