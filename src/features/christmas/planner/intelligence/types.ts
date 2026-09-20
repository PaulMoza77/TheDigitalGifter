import type {
  BudgetCategory,
  BudgetEntry,
  GiftItem,
  GiftItemStatus,
  GiftRecipient,
  GroceryAisle,
  PlanMode,
  PlannerAccess,
  PlannerProfile,
  PlannerTask,
  PreparedLevel,
  TaskCategory,
} from "../types";

export const INSIGHT_SEVERITIES = ["info", "suggestion", "important", "urgent"] as const;
export type InsightSeverity = (typeof INSIGHT_SEVERITIES)[number];

export const INSIGHT_CATEGORIES = [
  "gifts",
  "budget",
  "food",
  "hosting",
  "travel",
  "calendar",
  "tasks",
  "shopping",
  "cards",
  "general",
] as const;
export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

export const PLANNER_ACTION_TYPES = [
  "create_task",
  "reschedule_task",
  "reschedule_tasks",
  "add_recipient",
  "set_recipient_budget",
  "add_gift_idea",
  "update_gift_status",
  "set_total_budget",
  "add_meal",
  "add_grocery_item",
  "add_event",
  "ensure_hosting_tasks",
  "add_guest",
] as const;
export type PlannerActionType = (typeof PLANNER_ACTION_TYPES)[number];

export type InsightNotifyMeta = {
  notifyEligible: boolean;
  notifyAfter: string | null;
  urgency: InsightSeverity;
  dedupeKey: string;
};

export type PlannerInsight = {
  id: string;
  type: string;
  severity: InsightSeverity;
  category: InsightCategory;
  title: string;
  body: string;
  reason: string;
  recommendedAction: string;
  actionType: PlannerActionType | "open_module" | "review_reschedule" | "none";
  actionPayload: Record<string, unknown>;
  dueDate: string | null;
  priority: number;
  dismissible: boolean;
  autoResolvable: boolean;
} & InsightNotifyMeta;

export type SnapshotTask = {
  id: string;
  title: string;
  category: TaskCategory;
  due_on: string | null;
  status: PlannerTask["status"];
  priority: PlannerTask["priority"];
  origin: PlannerTask["origin"];
  template_key: string | null;
};

export type SnapshotRecipient = {
  id: string;
  display_name: string;
  relationship: string;
  budget_minor: number | null;
};

export type SnapshotGift = {
  id: string;
  recipient_id: string;
  idea: string;
  selected_gift: string;
  store: string;
  url: string | null;
  planned_price_minor: number | null;
  actual_price_minor: number | null;
  status: GiftItemStatus;
  delivery_on: string | null;
  return_deadline: string | null;
  source_type?: string;
  price_checked_at?: string | null;
  currency?: string | null;
};

export type SnapshotBudgetEntry = {
  id: string;
  category: BudgetCategory;
  label: string;
  planned_minor: number;
  spent_minor: number;
  source_type?: "manual" | "gift" | "grocery" | "system";
  source_ref?: string | null;
};

export type SnapshotMeal = {
  id: string;
  section: string;
  title: string;
  meal_on: string | null;
};

export type SnapshotDish = {
  id: string;
  meal_id: string;
  recipe_id: string | null;
  dish_name: string;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  day_time: string;
};

export type SnapshotRecipe = {
  id: string;
  title: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  category: string;
  tags: string[];
  ingredients: unknown;
};

export type SnapshotGrocery = {
  id: string;
  name: string;
  quantity: string;
  status: "have" | "need" | "bought";
  source_type: string;
  meal_item_id: string | null;
  ingredient_key?: string | null;
};

export type SnapshotGuest = {
  id: string;
  display_name: string;
  rsvp: "yes" | "no" | "maybe";
  adults: number;
  kids: number;
  dietary: string;
  sleeping: string;
};

export type SnapshotHome = {
  id: string;
  title: string;
  area: string;
  status: string;
};

export type SnapshotTrip = {
  id: string;
  destination: string;
  start_on: string | null;
  end_on: string | null;
  packing: string;
  gifts_to_take: string;
};

export type SnapshotEvent = {
  id: string;
  title: string;
  event_kind: string;
  starts_on: string;
  source_type: string;
  source_ref: string | null;
};

export type SnapshotCard = {
  id: string;
  status: string;
};

export type SnapshotTradition = {
  id: string;
  status: string;
  scheduled_on: string | null;
};

export type PlannerSnapshot = {
  season: number;
  today: string;
  daysLeft: number;
  timezone: string;
  currency: string;
  planMode: PlanMode;
  profile: {
    id: string;
    userId: string;
    hosting: boolean;
    travelling: boolean;
    hasChildren: boolean;
    preparedLevel: PreparedLevel;
    chaosAreas: string[];
    totalBudgetMinor: number | null;
    onboardingCompleted: boolean;
  };
  tasks: SnapshotTask[];
  recipients: SnapshotRecipient[];
  gifts: SnapshotGift[];
  budgetEntries: SnapshotBudgetEntry[];
  meals: SnapshotMeal[];
  dishes: SnapshotDish[];
  recipes: SnapshotRecipe[];
  grocery: SnapshotGrocery[];
  guests: SnapshotGuest[];
  home: SnapshotHome[];
  trips: SnapshotTrip[];
  events: SnapshotEvent[];
  cards: SnapshotCard[];
  traditions: SnapshotTradition[];
};

export type NextBestAction = {
  id: string;
  title: string;
  reason: string;
  score: number;
  href: string;
  actionType: PlannerInsight["actionType"];
  actionPayload: Record<string, unknown>;
  category: InsightCategory;
};

export type RecipientBudgetState = {
  recipientId: string;
  displayName: string;
  budgetMinor: number | null;
  plannedMinor: number;
  actualMinor: number;
  committedMinor: number;
  remainingMinor: number | null;
  status: "no_budget" | "under" | "close" | "over";
};

export type BudgetTotals = {
  totalBudgetMinor: number | null;
  giftPlannedMinor: number;
  giftSpentMinor: number;
  giftCommittedMinor: number;
  manualPlannedMinor: number;
  manualSpentMinor: number;
  spentMinor: number;
  plannedOutstandingMinor: number;
  forecastMinor: number;
  remainingMinor: number | null;
  remainingAfterSpendMinor: number | null;
  overForecastMinor: number;
  giftsWithoutPriceCount: number;
  groceryCostKnown: boolean;
  groceryPlannedMinor: number | null;
  categoryRows: Array<{
    category: BudgetCategory;
    label: string;
    budgetMinor: number;
    spentMinor: number;
    plannedMinor: number;
    remainingMinor: number;
    overMinor: number;
  }>;
  categoryForecast: Array<{
    category: BudgetCategory | "gifts_derived";
    plannedMinor: number;
    spentMinor: number;
    forecastMinor: number;
    source: "manual" | "gifts";
  }>;
};

export type ShoppingBucket = "to_buy" | "ordered" | "arriving" | "arrived" | "completed" | "returns";

export type DerivedShoppingItem = {
  id: string;
  giftId: string;
  title: string;
  bucket: ShoppingBucket;
  status: GiftItemStatus;
  deliveryOn: string | null;
  returnDeadline: string | null;
  store: string;
  url: string | null;
  priceMinor: number | null;
  priceCheckedAt: string | null;
  sourceType?: string;
  actionable: boolean;
};

export type DerivedCalendarItem = {
  id: string;
  date: string;
  title: string;
  kind: "task" | "event" | "gift_delivery" | "gift_return" | "travel";
  sourceId: string;
  href: string | null;
};

export type NormalizedIngredient = {
  key: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: GroceryAisle;
  displayQuantity: string;
  sources: string[];
};

export type GroceryMergeRow = {
  key: string;
  name: string;
  aisle: GroceryAisle;
  displayQuantity: string;
  status: "have" | "need" | "bought";
  persistedId: string | null;
  derived: boolean;
  sources?: string[];
};

export type FoodCompleteness = {
  mealId: string;
  section: string;
  title: string;
  present: string[];
  missing: string[];
};

export type PrepSuggestion = {
  id: string;
  date: string;
  time: string | null;
  title: string;
  reason: string;
};

export type ServingScaleHint = {
  dishId: string;
  dishName: string;
  recipeServings: number;
  mealServings: number;
  guestCount: number;
  suggestedServings: number;
  needsScale: boolean;
};

export type TravelConflict = {
  taskId: string;
  title: string;
  oldDate: string | null;
  suggestedDate: string;
  reason: string;
};

export type RescueAssessment = {
  active: boolean;
  essentialRemaining: number;
  reason: string;
  essentialTaskIds: string[];
  deprioritizedTaskIds: string[];
};

export type PlannerIntelligence = {
  snapshot: PlannerSnapshot;
  insights: PlannerInsight[];
  attention: PlannerInsight[];
  nextBestAction: NextBestAction | null;
  readiness: {
    percent: number;
    parts: Array<{ key: string; label: string; weight: number; score: number; detail: string }>;
  };
  rescue: RescueAssessment;
  budget: BudgetTotals;
  recipientBudgets: RecipientBudgetState[];
  shopping: DerivedShoppingItem[];
  calendar: DerivedCalendarItem[];
  grocery: GroceryMergeRow[];
  foodCompleteness: FoodCompleteness[];
  prepTimeline: PrepSuggestion[];
  servingHints: ServingScaleHint[];
  travelConflicts: TravelConflict[];
  hostingTaskKeysNeeded: string[];
  todayPriorities: SnapshotTask[];
};

export type ActionContext = {
  userId: string;
  access: PlannerAccess | null;
  profile: Pick<
    PlannerProfile,
    | "id"
    | "user_id"
    | "season_year"
    | "hosting"
    | "travelling"
    | "timezone"
    | "prepared_level"
    | "plan_mode"
    | "currency"
    | "has_children"
    | "total_budget_minor"
    | "onboarding_completed_at"
    | "metadata"
  >;
};

export type ActionResult =
  | { ok: true; data?: Record<string, unknown> }
  | { ok: false; error: string; code: string; preview?: Record<string, unknown> };

export type PlannerActionRequest = {
  type: PlannerActionType;
  payload: Record<string, unknown>;
  confirm?: boolean;
};

export function toSnapshotTask(task: PlannerTask): SnapshotTask {
  return {
    id: task.id,
    title: task.title,
    category: task.category,
    due_on: task.due_on,
    status: task.status,
    priority: task.priority,
    origin: task.origin,
    template_key: task.template_key,
  };
}

export function toSnapshotRecipient(row: GiftRecipient): SnapshotRecipient {
  return {
    id: row.id,
    display_name: row.display_name,
    relationship: row.relationship,
    budget_minor: row.budget_minor,
  };
}

export function toSnapshotGift(row: GiftItem): SnapshotGift {
  const meta = row.source_meta as { currency?: string } | null | undefined;
  const metaCurrency = typeof meta?.currency === "string" ? meta.currency : null;
  return {
    id: row.id,
    recipient_id: row.recipient_id,
    idea: row.idea,
    selected_gift: row.selected_gift,
    store: row.store,
    url: row.url,
    planned_price_minor: row.planned_price_minor,
    actual_price_minor: row.actual_price_minor,
    status: row.status,
    delivery_on: row.delivery_on,
    return_deadline: row.return_deadline,
    source_type: row.source_type,
    price_checked_at: row.price_checked_at ?? null,
    currency: metaCurrency,
  };
}

export function toSnapshotBudget(row: BudgetEntry): SnapshotBudgetEntry {
  return {
    id: row.id,
    category: row.category,
    label: row.label,
    planned_minor: row.planned_minor,
    spent_minor: row.spent_minor,
    source_type: row.source_type,
    source_ref: row.source_ref ?? null,
  };
}
