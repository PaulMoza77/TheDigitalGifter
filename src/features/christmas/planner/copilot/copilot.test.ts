import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sanitizePlannerMetadata } from "../analytics";
import { buildPlannerSnapshot } from "../intelligence/snapshot";
import { runPlannerIntelligence } from "../intelligence/engine";
import { askCopilot, copilotLlmEnabled } from "./ask";
import { copilotNextWin, copilotSuggestions } from "./context";
import { proposeCopilotPlan } from "./plan";
import { applyCopilotPlan, confirmationClassFor, isWriteTool } from "./registry";
import type { GiftItem, GiftRecipient, PlannerProfile, PlannerTask } from "../types";

const NOW = new Date("2026-12-12T12:00:00Z");

function profile(patch: Partial<PlannerProfile> = {}): PlannerProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    season_year: 2026,
    country_code: "IE",
    currency: "eur",
    timezone: "UTC",
    household_label: "",
    recipient_count_approx: 2,
    total_budget_minor: 80000,
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

function fixture() {
  const recipients: GiftRecipient[] = [
    { id: "r1", profile_id: "profile-1", display_name: "Dad", relationship: "family", budget_minor: 20000, notes: "secret" },
    { id: "r2", profile_id: "profile-1", display_name: "Maya", relationship: "family", budget_minor: 20000, notes: "" },
  ];
  const gifts: GiftItem[] = [
    {
      id: "g2",
      profile_id: "profile-1",
      recipient_id: "r2",
      idea: "scarf",
      selected_gift: "Scarf",
      url: null,
      store: "",
      planned_price_minor: 4000,
      actual_price_minor: null,
      status: "planned",
      hiding_place: "attic",
      delivery_on: null,
      return_deadline: null,
      source_type: "manual",
    },
  ];
  const tasks: PlannerTask[] = [
    {
      id: "t1",
      profile_id: "profile-1",
      title: "Order shipped gifts",
      category: "shopping",
      due_on: "2026-12-10",
      status: "open",
      priority: "high",
      notes: "do not leak",
      origin: "system",
      template_key: "order_shipped_gifts",
    },
    {
      id: "t2",
      profile_id: "profile-1",
      title: "Wrap remaining gifts",
      category: "gifts",
      due_on: "2026-12-24",
      status: "open",
      priority: "low",
      notes: "",
      origin: "system",
      template_key: "wrap_gifts",
    },
    {
      id: "t3",
      profile_id: "profile-1",
      title: "Do the main grocery shop",
      category: "food",
      due_on: "2026-12-13",
      status: "open",
      priority: "high",
      notes: "",
      origin: "system",
      template_key: "grocery_shop",
    },
  ];
  const snapshot = buildPlannerSnapshot({
    profile: profile(),
    tasks,
    recipients,
    gifts,
    budgetEntries: [{ id: "b1", profile_id: "profile-1", category: "food", label: "food", planned_minor: 10000, spent_minor: 2000 }],
    meals: [],
    grocery: [{ id: "gr1", name: "Butter", quantity: "1", status: "need", source_type: "manual", meal_item_id: null }],
    trips: [{ id: "tr1", destination: "Galway", start_on: "2026-12-22", end_on: "2026-12-27", packing: "secret packing", gifts_to_take: "" }],
    now: NOW,
  });
  return runPlannerIntelligence(snapshot);
}

describe("christmas copilot P0 on Intelligence Engine", () => {
  it("answers from the saved plan without leaking notes or hiding places", () => {
    const intel = fixture();
    expect(intel.snapshot.trips[0]?.start_on).toBe("2026-12-22");
    const weekend = askCopilot("What should I do this weekend?", intel);
    expect(weekend.modelPath).toBe("deterministic");
    expect(weekend.requiresConfirmation).toBe(false);
    expect(weekend.message.toLowerCase()).toMatch(/% ready|day/);

    const forget = askCopilot("What am I forgetting?", intel);
    expect(forget.message.length).toBeGreaterThan(10);

    const budget = askCopilot("I only have €500 left.", intel);
    expect(budget.cards.some((c) => c.type === "budget_summary")).toBe(true);

    const dad = askCopilot("Dad still needs a gift.", intel);
    expect(dad.message).toContain("Dad");

    const dinner = askCopilot("We have 10 people for dinner.", intel);
    expect(dinner.unsupported?.asked).toBe("add_meal");

    const travel = askCopilot("I’m travelling on Dec 22.", intel);
    expect(travel.message).toMatch(/2026-12-22|conflict/);

    const move = askCopilot("Move my important tasks earlier.", intel);
    expect(move.unsupported?.reason).toBe("no_tool");

    const grocery = askCopilot("Give me a grocery list.", intel);
    expect(grocery.message.toLowerCase()).toMatch(/grocery|meal|food/);

    const behind = askCopilot("I’m completely behind.", intel);
    expect(behind.tone).toBe("rescue");

    const ignore = askCopilot("What can I safely ignore?", intel);
    expect(ignore.modelPath).toBe("deterministic");

    const blob = JSON.stringify(askCopilot("What am I forgetting?", intel));
    expect(blob).not.toContain("attic");
    expect(blob).not.toContain("secret packing");
    expect(blob).not.toContain("do not leak");
  });

  it("builds page suggestions from live snapshot names and money", () => {
    const intel = fixture();
    const gifts = copilotSuggestions("/account/christmas/gifts", intel);
    expect(gifts.some((row) => row.label.includes("Dad") || row.label.includes("Maya"))).toBe(true);
    expect(gifts.every((row) => !row.label.includes("Andreas"))).toBe(true);
    const win = copilotNextWin("/account/christmas/gifts", intel);
    expect(win.kicker).toBe("Your next little win");
    expect(win.title.length).toBeGreaterThan(8);
  });

  it("never enables the LLM path; apply requires a confirmed plan", async () => {
    expect(copilotLlmEnabled()).toBe(false);
    const appliedMissing = await applyCopilotPlan();
    expect(appliedMissing.ok).toBe(false);
    if (!appliedMissing.ok) expect(appliedMissing.code).toBe("missing_plan");
    expect(confirmationClassFor("reschedule_task", 3)).toBe("bulk");
    expect(isWriteTool("create_task")).toBe(true);
    expect(isWriteTool("read_snapshot")).toBe(false);
    const intel = fixture();
    const plan = proposeCopilotPlan("Add one guest and recalculate.", intel, "v");
    expect(plan?.steps[0]?.tool).toBe("add_guest");
    const appliedOk = await applyCopilotPlan({
      plan: plan!,
      confirm: true,
      snapshotVersion: "v",
      execute: async () => ({ ok: true }),
    });
    expect(appliedOk.ok).toBe(true);
    if (appliedOk.ok) expect(appliedOk.applied).toBe(1);
  });

  it("keeps copilot analytics free of names and notes", () => {
    const clean = sanitizePlannerMetadata({
      intent: "deterministic",
      display_name: "Dad",
      notes: "allergy",
      budget: 500,
    });
    expect(clean.intent).toBe("deterministic");
    expect(clean.display_name).toBeUndefined();
  });
});

describe("copilot wiring is local-only", () => {
  it("does not add a production LLM edge function in this release", () => {
    const layout = readFileSync(resolve(process.cwd(), "src/features/christmas/planner/ChristmasPlannerLayout.tsx"), "utf8");
    expect(layout).toContain("CopilotHost");
    expect(layout).toContain("CopilotSurface");
    const ask = readFileSync(resolve(process.cwd(), "src/features/christmas/planner/copilot/ask.ts"), "utf8");
    expect(ask).not.toContain("api.openai.com");
    const panel = readFileSync(resolve(process.cwd(), "src/features/christmas/planner/copilot/ChristmasCopilotPanel.tsx"), "utf8");
    expect(panel).toContain("ChristmasCopilotPanel");
    expect(panel).not.toContain("Andreas");
    const ctx = readFileSync(resolve(process.cwd(), "src/features/christmas/planner/copilot/context.ts"), "utf8");
    expect(ctx).toContain("christmas_hero_room.webp");
    expect(ctx).not.toContain("Andreas");
  });
});
