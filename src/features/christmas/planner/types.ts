export const PLANNER_FEATURE_KEYS = [
  "planner_core",
  "gift_planner",
  "budget",
  "food_planner",
  "recipes",
  "hosting",
  "travel",
  "advanced_planning",
  "rescue_mode",
  "premium_content",
] as const;

export type PlannerFeatureKey = (typeof PLANNER_FEATURE_KEYS)[number];

export const PLANNER_PRODUCT_KEYS = [
  "christmas_planner_2026",
  "christmas_planner",
  "christmas_planner_food",
  "christmas_planner_recipes",
  "christmas_planner_hosting",
  "christmas_planner_travel",
] as const;

export type PlannerProductKey = (typeof PLANNER_PRODUCT_KEYS)[number];

export const PLANNER_CORE_FEATURES: readonly PlannerFeatureKey[] = [
  "planner_core",
  "gift_planner",
  "budget",
  "advanced_planning",
  "rescue_mode",
];

export const PLANNER_COMPLETE_FEATURES: readonly PlannerFeatureKey[] = [
  "planner_core",
  "gift_planner",
  "budget",
  "food_planner",
  "recipes",
  "hosting",
  "travel",
  "advanced_planning",
  "rescue_mode",
  "premium_content",
];

export const PLANNER_PACKAGE_FEATURES: Record<string, readonly PlannerFeatureKey[]> = {
  founding_pass: PLANNER_COMPLETE_FEATURES,
  essentials: PLANNER_CORE_FEATURES,
  core: PLANNER_CORE_FEATURES,
  magic: PLANNER_COMPLETE_FEATURES,
  complete: PLANNER_COMPLETE_FEATURES,
  all_in: PLANNER_COMPLETE_FEATURES,
  food: ["food_planner", "recipes"],
  recipes: ["recipes", "premium_content"],
  hosting: ["hosting"],
  travel: ["travel"],
};

export const PLANNER_PAID_TIER_KEYS = ["founding_pass", "essentials", "magic", "all_in"] as const;
export const PLANNER_ADDON_PACKAGE_KEYS = ["food", "recipes", "hosting", "travel"] as const;

export const TASK_CATEGORIES = [
  "gifts",
  "shopping",
  "cards",
  "food",
  "hosting",
  "home",
  "decorating",
  "travel",
  "family",
  "events",
  "personal",
  "other",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_STATUSES = ["open", "done", "skipped", "rescheduled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const GIFT_ITEM_STATUSES = [
  "idea",
  "planned",
  "ordered",
  "arrived",
  "hidden",
  "wrapped",
  "given",
] as const;
export type GiftItemStatus = (typeof GIFT_ITEM_STATUSES)[number];

export const BUDGET_CATEGORIES = [
  "gifts",
  "food",
  "travel",
  "decor",
  "events",
  "clothing",
  "charity",
  "other",
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

/** Consumer-facing Budget dashboard categories (maps onto existing DB keys). */
export const BUDGET_DASHBOARD_CATEGORIES = [
  "gifts",
  "food",
  "decor",
  "travel",
  "events",
  "other",
] as const;
export type BudgetDashboardCategory = (typeof BUDGET_DASHBOARD_CATEGORIES)[number];

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  gifts: "Gifts",
  food: "Food & Drinks",
  decor: "Decorations",
  travel: "Travel",
  events: "Activities",
  clothing: "Other",
  charity: "Other",
  other: "Other",
};

export const PLANNER_CURRENCIES = ["eur", "usd", "gbp", "ron"] as const;
export type PlannerCurrency = (typeof PLANNER_CURRENCIES)[number];

export const FOUNDING_PASS_PACKAGE_KEY = "founding_pass";
export const FOUNDING_PASS_PRICE_CENTS = 1700;
export const FOUNDING_PASS_CURRENCY = "usd";
export const FOUNDING_PASS_PRICE_LABEL = "$17";

export const MEAL_SECTIONS = [
  "christmas_eve",
  "christmas_day",
  "parties",
  "breakfast",
  "desserts",
  "drinks",
  "other",
] as const;
export type MealSection = (typeof MEAL_SECTIONS)[number];

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

export const HOME_AREAS = [
  "tree",
  "living_room",
  "dining",
  "outside",
  "guest_rooms",
  "other",
] as const;

export const GROCERY_AISLES = [
  "produce",
  "meat",
  "dairy",
  "bakery",
  "pantry",
  "frozen",
  "drinks",
  "other",
] as const;
export type GroceryAisle = (typeof GROCERY_AISLES)[number];

export const TRADITION_SECTIONS = ["family", "kids", "couple", "friends", "kindness"] as const;

export const PLAN_MODES = ["early", "standard", "sprint", "rescue", "wrap"] as const;
export type PlanMode = (typeof PLAN_MODES)[number];

export const PREPARED_LEVELS = ["starting", "some", "mostly", "rescue"] as const;
export type PreparedLevel = (typeof PREPARED_LEVELS)[number];

export type PlannerProfile = {
  id: string;
  user_id: string;
  season_year: number;
  country_code: string;
  currency: string;
  timezone: string;
  household_label: string;
  recipient_count_approx: number;
  total_budget_minor: number | null;
  hosting: boolean;
  travelling: boolean;
  has_children: boolean;
  prepared_level: PreparedLevel;
  known_dates: Array<{ label: string; on: string }>;
  onboarding_completed_at: string | null;
  plan_mode: PlanMode;
  locale: string;
  metadata?: Record<string, unknown>;
};

export type PlannerTask = {
  id: string;
  profile_id: string;
  title: string;
  category: TaskCategory;
  due_on: string | null;
  status: TaskStatus;
  priority: "low" | "normal" | "high";
  notes: string;
  origin: "system" | "user";
  template_key: string | null;
};

export type GiftRecipient = {
  id: string;
  profile_id: string;
  display_name: string;
  relationship: string;
  budget_minor: number | null;
  notes: string;
};

export type GiftSourceMeta = {
  provider?: string;
  externalProductId?: string;
  currency?: string;
  condition?: string | null;
  marketplace?: string;
};

export type GiftItem = {
  id: string;
  profile_id: string;
  recipient_id: string;
  idea: string;
  selected_gift: string;
  url: string | null;
  store: string;
  planned_price_minor: number | null;
  actual_price_minor: number | null;
  status: GiftItemStatus;
  hiding_place: string;
  delivery_on: string | null;
  return_deadline: string | null;
  source_type: "manual" | "gift_finder" | "wishlist" | "affiliate_product";
  source_ref: string | null;
  image_url?: string | null;
  price_checked_at?: string | null;
  source_meta?: GiftSourceMeta | Record<string, unknown> | null;
};

export type BudgetSourceType = "manual" | "gift" | "grocery" | "system";

export type BudgetEntry = {
  id: string;
  profile_id: string;
  category: BudgetCategory;
  label: string;
  planned_minor: number;
  spent_minor: number;
  source_type?: BudgetSourceType;
  source_ref?: string | null;
};

export type PlannerAccess = {
  ok: boolean;
  season_year: number;
  features: PlannerFeatureKey[];
  package_keys: string[];
  paid: boolean;
};

export const FREE_LIMITS = {
  maxRecipients: 3,
  maxOpenTasks: 8,
  maxCustomTasks: 5,
  maxBudgetCategories: 2,
  teaserRecipes: 2,
} as const;

export const PLANNER_ACCOUNT_ROUTE = "/account/christmas";
export const PLANNER_PUBLIC_ROUTE = "/christmas/planner";
export const PLANNER_WELCOME_ROUTE = "/christmas/planner/welcome";
export const PLANNER_UPGRADE_HASH = "pricing";
export const PLANNER_ORDER_STORAGE_KEY = "tdg.christmas.planner.order.v1";
