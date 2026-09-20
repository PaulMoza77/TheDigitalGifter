import { describe, expect, it } from "vitest";
import { buildPlannerSnapshot } from "./snapshot";
import { runPlannerIntelligence } from "./engine";
import { computeBudgetTotals, giftCommittedMinor } from "./budgetIntelligence";
import { deriveShoppingItems, shoppingForTab, computeRecipientBudgets } from "./giftIntelligence";
import { deriveCalendarItems } from "./calendarIntelligence";
import {
  aggregateMealIngredients,
  detectFoodCompleteness,
  ingredientsFromRecipe,
  mergeGroceryList,
  parseIngredient,
  servingHints,
} from "./foodIntelligence";
import { detectTravelConflicts } from "./travelIntelligence";
import { hostingTasksToInsert, missingHostingTemplateKeys } from "./hostingIntelligence";
import { computeReadiness } from "./readinessIntelligence";
import { validatePlannerAction, DESTRUCTIVE_ACTIONS } from "./actionContract";
import type { PlannerProfile, PlannerTask, GiftItem, GiftRecipient } from "../types";
import { christmasDayParts, localDateParts } from "../date";

const NOW = new Date("2026-12-10T12:00:00Z");

function profile(patch: Partial<PlannerProfile> = {}): PlannerProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    season_year: 2026,
    country_code: "IE",
    currency: "eur",
    timezone: "UTC",
    household_label: "",
    recipient_count_approx: 8,
    total_budget_minor: 150000,
    hosting: true,
    travelling: true,
    has_children: false,
    prepared_level: "some",
    known_dates: [],
    onboarding_completed_at: "2026-09-01T00:00:00Z",
    plan_mode: "sprint",
    locale: "en",
    ...patch,
  };
}

function task(patch: Partial<PlannerTask> & Pick<PlannerTask, "id" | "title">): PlannerTask {
  return {
    profile_id: "profile-1",
    category: "gifts",
    due_on: "2026-12-24",
    status: "open",
    priority: "high",
    notes: "private note should never be required",
    origin: "system",
    template_key: null,
    ...patch,
  };
}

function recipient(id: string, name: string, budget: number | null = 10000): GiftRecipient {
  return { id, profile_id: "profile-1", display_name: name, relationship: "family", budget_minor: budget, notes: "secret" };
}

function gift(patch: Partial<GiftItem> & Pick<GiftItem, "id" | "recipient_id">): GiftItem {
  return {
    profile_id: "profile-1",
    idea: "idea",
    selected_gift: patch.selected_gift || "Gift",
    url: null,
    store: "",
    planned_price_minor: null,
    actual_price_minor: null,
    status: "planned",
    hiding_place: "",
    delivery_on: null,
    return_deadline: null,
    source_type: "manual",
    source_ref: null,
    ...patch,
  };
}

const people = ["Dad", "Mom", "Sam", "Alex", "Pat", "Kim", "Lee", "Jo"].map((name, i) =>
  recipient(`r${i + 1}`, name, name === "Mom" ? 10000 : 20000),
);

function scenario() {
  const gifts: GiftItem[] = [
    gift({ id: "g1", recipient_id: "r1", selected_gift: "Watch", planned_price_minor: 90000, status: "planned", delivery_on: "2026-12-24" }),
    gift({ id: "g2", recipient_id: "r2", selected_gift: "Scarf", planned_price_minor: 11800, status: "planned" }),
    gift({ id: "g3", recipient_id: "r3", idea: "Book", planned_price_minor: 25000, status: "ordered" }),
    gift({ id: "g4", recipient_id: "r4", idea: "Game", planned_price_minor: 4000, actual_price_minor: 3800, status: "arrived" }),
    gift({ id: "g5", recipient_id: "r5", idea: "Candle", planned_price_minor: 20000, status: "wrapped" }),
    gift({ id: "g6", recipient_id: "r6", idea: "Socks", planned_price_minor: 15000, status: "given" }),
  ];
  const tasks: PlannerTask[] = [
    task({ id: "t1", title: "Wrap gifts", template_key: "wrap_gifts", due_on: "2026-12-24", category: "gifts" }),
    task({ id: "t2", title: "Send cards", template_key: "send_cards", due_on: "2026-12-23", category: "cards" }),
    task({ id: "t3", title: "Final grocery shop", template_key: "grocery_shop", due_on: "2026-12-23", category: "food" }),
    task({ id: "t4", title: "Lights walk", category: "events", priority: "low", due_on: "2026-12-20" }),
    task({ id: "t5", title: "Overdue order", template_key: "order_shipped_gifts", due_on: "2026-12-01", category: "shopping" }),
  ];
  return buildPlannerSnapshot({
    profile: profile(),
    tasks,
    recipients: people,
    gifts,
    budgetEntries: [
      { id: "b1", profile_id: "profile-1", category: "food", label: "food", planned_minor: 20000, spent_minor: 0 },
    ],
    meals: [{ id: "m1", section: "christmas_day", title: "Christmas Day", meal_on: "2026-12-25" }],
    dishes: [
      {
        id: "d1",
        meal_id: "m1",
        recipe_id: "rec1",
        dish_name: "Herb roast",
        servings: 4,
        prep_minutes: 20,
        cook_minutes: 75,
        day_time: "",
      },
      {
        id: "d2",
        meal_id: "m1",
        recipe_id: "rec2",
        dish_name: "Honey carrots",
        servings: 4,
        prep_minutes: 10,
        cook_minutes: 30,
        day_time: "",
      },
    ],
    recipes: [
      {
        id: "rec1",
        title: "Herb roast",
        servings: 4,
        prep_minutes: 20,
        cook_minutes: 75,
        category: "christmas_dinner",
        tags: [],
        ingredients: ["1 roast", "80g butter"],
      },
      {
        id: "rec2",
        title: "Honey carrots",
        servings: 4,
        prep_minutes: 10,
        cook_minutes: 30,
        category: "side_dishes",
        tags: ["make-ahead"],
        ingredients: ["800g carrots, halved", "2 tbsp honey", "800g carrots, halved"],
      },
    ],
    grocery: [],
    guests: [
      { id: "u1", display_name: "A", rsvp: "maybe", adults: 2, kids: 0, dietary: "vegetarian", sleeping: "" },
      { id: "u2", display_name: "B", rsvp: "yes", adults: 4, kids: 2, dietary: "", sleeping: "guest room" },
    ],
    home: [{ id: "h1", title: "Guest room", area: "guest_rooms", status: "todo" }],
    trips: [{ id: "tr1", destination: "Galway", start_on: "2026-12-22", end_on: "2026-12-27", packing: "", gifts_to_take: "" }],
    events: [],
    cards: [{ id: "c1", status: "needed" }],
    traditions: [],
    now: NOW,
  });
}

describe("gifts / budget", () => {
  it("uses planned gift price in forecast and actual in spent without double counting", () => {
    const snapshot = scenario();
    const totals = computeBudgetTotals(snapshot);
    const watch = snapshot.gifts.find((g) => g.id === "g1")!;
    const arrived = snapshot.gifts.find((g) => g.id === "g4")!;
    expect(giftCommittedMinor(watch)).toBe(90000);
    expect(totals.giftSpentMinor).toBe(3800);
    expect(totals.spentMinor).toBe(3800);
    expect(totals.forecastMinor).toBeGreaterThan(150000);
    expect(arrived.planned_price_minor).toBe(4000);
    expect(totals.giftCommittedMinor).toBe(
      snapshot.gifts.reduce((s, g) => s + (g.actual_price_minor || g.planned_price_minor || 0), 0),
    );
    expect(totals.spentMinor).not.toBe(totals.spentMinor + arrived.planned_price_minor!);
  });
});

describe("gifts / shopping", () => {
  it("maps statuses into derived buckets and hides wrapped from actionable lists", () => {
    const items = deriveShoppingItems(scenario().gifts);
    expect(shoppingForTab(items, "need").map((i) => i.giftId).sort()).toEqual(["g1", "g2"]);
    expect(shoppingForTab(items, "ordered").map((i) => i.giftId)).toEqual(["g3"]);
    expect(shoppingForTab(items, "arrived").map((i) => i.giftId)).toEqual(["g4"]);
    expect(items.find((i) => i.giftId === "g5")?.bucket).toBe("completed");
    expect(items.find((i) => i.giftId === "g5")?.actionable).toBe(false);
    expect(shoppingForTab(items, "need").some((i) => i.giftId === "g5")).toBe(false);
  });
});

describe("gifts / calendar", () => {
  it("derives delivery and return without duplicating generated items", () => {
    const snapshot = scenario();
    snapshot.gifts[0] = { ...snapshot.gifts[0], return_deadline: "2026-12-31" };
    const items = deriveCalendarItems(snapshot);
    const deliveries = items.filter((i) => i.kind === "gift_delivery");
    const returns = items.filter((i) => i.kind === "gift_return");
    expect(deliveries.some((i) => i.sourceId === "g1")).toBe(true);
    expect(returns.some((i) => i.sourceId === "g1")).toBe(true);
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("budget insights", () => {
  it("flags over-budget forecast, recipient overage, and remaining", () => {
    const intel = runPlannerIntelligence(scenario());
    expect(intel.insights.some((i) => i.id === "budget.forecast_over")).toBe(true);
    expect(intel.insights.some((i) => i.id === "gifts.recipient_over:r2")).toBe(true);
    expect(intel.budget.remainingMinor).toBe(150000 - intel.budget.forecastMinor);
    const mom = computeRecipientBudgets(intel.snapshot).find((r) => r.recipientId === "r2");
    expect(mom?.status).toBe("over");
  });
});

describe("food intelligence", () => {
  it("aggregates recipe ingredients, scales servings, merges grocery, and detects completeness", () => {
    const snapshot = scenario();
    const parsed = parseIngredient("800g carrots, halved");
    expect(parsed?.name.toLowerCase()).toContain("carrot");
    const aggregated = aggregateMealIngredients(snapshot);
    const carrots = aggregated.find((i) => i.name.includes("carrot"));
    expect(carrots?.quantity).toBe(1600);
    const grocery = mergeGroceryList(snapshot);
    expect(grocery.some((g) => g.name.includes("carrot"))).toBe(true);
    const complete = detectFoodCompleteness(snapshot);
    expect(complete[0]?.missing).toContain("dessert");
    const hints = servingHints(snapshot);
    expect(hints.some((h) => h.needsScale)).toBe(true);
    const intel = runPlannerIntelligence(snapshot);
    expect(intel.insights.some((i) => i.id === "food.completeness:christmas_day")).toBe(true);
  });

  it("merges grams and kilograms for the same ingredient", () => {
    const merged = ingredientsFromRecipe(
      {
        id: "pot",
        title: "Roast potatoes",
        servings: 4,
        prep_minutes: 10,
        cook_minutes: 40,
        category: "side_dishes",
        tags: [],
        ingredients: [
          { name: "potatoes", quantity: 500, unit: "g" },
          { name: "potatoes", quantity: 1, unit: "kg" },
        ],
      },
      4,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe(1500);
    expect(merged[0]?.displayQuantity).toBe("1.5 kg");
  });
});

describe("hosting tasks", () => {
  it("adds hosting tasks only when hosting and never duplicates template keys", () => {
    const hostingOff = buildPlannerSnapshot({
      profile: profile({ hosting: false }),
      tasks: [],
      recipients: [],
      gifts: [],
      budgetEntries: [],
      now: NOW,
    });
    expect(missingHostingTemplateKeys(hostingOff)).toEqual([]);
    const hostingOn = buildPlannerSnapshot({
      profile: profile({ hosting: true }),
      tasks: [
        task({ id: "x", title: "Confirm guests", template_key: "guest_rsvp", category: "hosting" }),
      ],
      recipients: [],
      gifts: [],
      budgetEntries: [],
      now: NOW,
    });
    const missing = missingHostingTemplateKeys(hostingOn);
    expect(missing).not.toContain("guest_rsvp");
    expect(missing.length).toBeGreaterThan(0);
    const insert = hostingTasksToInsert(hostingOn, localDateParts(NOW, "UTC"), christmasDayParts(2026));
    expect(insert.every((t) => t.template_key && missing.includes(t.template_key))).toBe(true);
    expect(new Set(insert.map((t) => t.template_key)).size).toBe(insert.length);
  });
});

describe("travel", () => {
  it("detects conflicts and suggests dates without mutating tasks", () => {
    const snapshot = scenario();
    const before = snapshot.tasks.map((t) => t.due_on);
    const conflicts = detectTravelConflicts(snapshot);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts.every((c) => c.suggestedDate <= "2026-12-22")).toBe(true);
    expect(snapshot.tasks.map((t) => t.due_on)).toEqual(before);
  });
});

describe("rescue and readiness", () => {
  it("activates focused essentials when late and behind, without dropping nice-to-haves", () => {
    const snapshot = scenario();
    snapshot.daysLeft = 6;
    snapshot.planMode = "rescue";
    const intel = runPlannerIntelligence(snapshot);
    expect(intel.rescue.active).toBe(true);
    expect(intel.rescue.deprioritizedTaskIds).toContain("t4");
    expect(intel.snapshot.tasks.find((t) => t.id === "t4")).toBeTruthy();
    expect(intel.todayPriorities[0]?.id).not.toBe("t4");
  });

  it("excludes irrelevant modules and moves when gifts complete", () => {
    const empty = computeReadiness({
      profile: { hosting: false, travelling: false, total_budget_minor: null, onboarding_completed_at: "x" },
      tasks: [{ status: "open", category: "gifts" }],
      recipients: [],
      gifts: [],
    });
    expect(empty.parts.some((p) => p.key === "meals")).toBe(false);
    expect(empty.parts.some((p) => p.key === "travel")).toBe(false);
    const started = computeReadiness({
      profile: { hosting: false, travelling: false, total_budget_minor: 50000, onboarding_completed_at: "x" },
      tasks: [{ status: "done", category: "gifts" }],
      recipients: [{ id: "a" }],
      gifts: [{ recipient_id: "a", status: "idea" }],
    });
    const done = computeReadiness({
      profile: { hosting: false, travelling: false, total_budget_minor: 50000, onboarding_completed_at: "x" },
      tasks: [{ status: "done", category: "gifts" }],
      recipients: [{ id: "a" }],
      gifts: [{ recipient_id: "a", status: "planned" }],
    });
    expect(done.percent).toBeGreaterThan(started.percent);
  });
});

describe("insights", () => {
  it("is deterministic, unique, and auto-resolves when data changes", () => {
    const snapshot = scenario();
    const a = runPlannerIntelligence(snapshot);
    const b = runPlannerIntelligence(snapshot);
    expect(a.insights.map((i) => i.id)).toEqual(b.insights.map((i) => i.id));
    expect(new Set(a.insights.map((i) => i.id)).size).toBe(a.insights.length);
    expect(a.insights.some((i) => i.id === "gifts.missing_ideas")).toBe(true);
    const covered = {
      ...snapshot,
      gifts: [
        ...snapshot.gifts,
        gift({ id: "g7", recipient_id: "r7", status: "planned", planned_price_minor: 1000 }),
        gift({ id: "g8", recipient_id: "r8", status: "planned", planned_price_minor: 1000 }),
      ],
    };
    const resolved = runPlannerIntelligence(covered);
    expect(resolved.insights.some((i) => i.id === "gifts.missing_ideas")).toBe(false);
  });
});

describe("actions", () => {
  it("validates ownership-shaped payloads and requires confirmation for bulk reschedule", () => {
    expect(validatePlannerAction({ type: "create_task", payload: {} }).ok).toBe(false);
    expect(validatePlannerAction({ type: "update_gift_status", payload: { giftId: "x", status: "nope" } }).ok).toBe(false);
    expect(validatePlannerAction({ type: "add_gift_idea", payload: { recipientId: "r1", idea: "Hat" } }).ok).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has("reschedule_tasks")).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has("create_task")).toBe(false);
  });
});

describe("engine story", () => {
  it("produces a coherent Today story from the QA scenario", () => {
    const intel = runPlannerIntelligence(scenario());
    expect(intel.nextBestAction).toBeTruthy();
    expect(intel.attention.length).toBeGreaterThan(0);
    expect(intel.attention.length).toBeLessThanOrEqual(3);
    expect(intel.insights.some((i) => i.id === "gifts.missing_ideas")).toBe(true);
    expect(intel.insights.some((i) => i.id === "budget.forecast_over")).toBe(true);
    expect(intel.insights.some((i) => i.id === "travel.task_conflicts")).toBe(true);
    expect(intel.insights.some((i) => i.id.startsWith("food.completeness"))).toBe(true);
    expect(JSON.stringify(intel.snapshot)).not.toContain("private note should never be required");
  });
});
