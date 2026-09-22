import { describe, expect, it } from "vitest";
import { buildPlannerSnapshot } from "../intelligence/snapshot";
import { runPlannerIntelligence } from "../intelligence/engine";
import type { GiftItem, GiftRecipient, PlannerProfile, PlannerTask } from "../types";
import {
  buildCopilotNextWin,
  buildCopilotSuggestions,
  copilotModuleFromPath,
} from "./context";

const NOW = new Date("2026-12-12T12:00:00Z");

function profile(): PlannerProfile {
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
    travelling: false,
    has_children: false,
    prepared_level: "some",
    known_dates: [],
    onboarding_completed_at: "2026-09-01T00:00:00Z",
    plan_mode: "sprint",
    locale: "en",
  };
}

function intel() {
  const recipients: GiftRecipient[] = [
    { id: "r1", profile_id: "profile-1", display_name: "Andreas", relationship: "family", budget_minor: 20000, notes: "" },
    { id: "r2", profile_id: "profile-1", display_name: "Emma", relationship: "family", budget_minor: 20000, notes: "" },
  ];
  const gifts: GiftItem[] = [
    {
      id: "g1",
      profile_id: "profile-1",
      recipient_id: "r2",
      idea: "scarf",
      selected_gift: "Scarf",
      url: null,
      store: "",
      planned_price_minor: 4000,
      actual_price_minor: null,
      status: "planned",
      hiding_place: "",
      delivery_on: null,
      return_deadline: null,
      source_type: "manual",
      source_ref: null,
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
      notes: "",
      origin: "system",
      template_key: "order_shipped_gifts",
    },
  ];
  const snapshot = buildPlannerSnapshot({
    profile: profile(),
    tasks,
    recipients,
    gifts,
    budgetEntries: [],
    meals: [],
    grocery: [],
    trips: [],
    now: NOW,
  });
  return runPlannerIntelligence(snapshot);
}

describe("copilot contextual prompts", () => {
  it("maps planner routes to modules", () => {
    expect(copilotModuleFromPath("/account/christmas/gifts")).toBe("gifts");
    expect(copilotModuleFromPath("/account/christmas/budget")).toBe("budget");
    expect(copilotModuleFromPath("/account/christmas/food")).toBe("meals");
    expect(copilotModuleFromPath("/account/christmas/plan")).toBe("plan");
  });

  it("builds gifts suggestions from real people and budget", () => {
    const suggestions = buildCopilotSuggestions("gifts", intel());
    expect(suggestions[0]?.label).toContain("Andreas");
    expect(suggestions.some((s) => /€|EUR|under/i.test(s.label))).toBe(true);
    const win = buildCopilotNextWin("gifts", intel());
    expect(win.body).toContain("Andreas");
  });
});
