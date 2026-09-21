import { describe, expect, it } from "vitest";
import { accessFromGrants, firstNameFromAuthUser, hasCompletePlanner, hasFeature } from "../entitlements";
import { dayGreeting, dayGreetingWord } from "../date";
import { buildPlannerSnapshot } from "../intelligence/snapshot";
import type { GiftItem, GiftRecipient, PlannerProfile, PlannerTask } from "../types";
import { buildModuleCards, collectHomeNextActions, giftCardProgress, mealCardProgress, showPlannerUpgrade } from "./homeStats";
import { moreRouteActive, searchPlannerModules } from "./modules";

function profile(patch: Partial<PlannerProfile> = {}): PlannerProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    season_year: 2026,
    country_code: "IE",
    currency: "eur",
    timezone: "UTC",
    household_label: "",
    recipient_count_approx: 4,
    total_budget_minor: null,
    hosting: false,
    travelling: false,
    has_children: false,
    prepared_level: "starting",
    known_dates: [],
    onboarding_completed_at: "2026-09-01T00:00:00Z",
    plan_mode: "standard",
    locale: "en",
    ...patch,
  };
}

function gift(patch: Partial<GiftItem> & Pick<GiftItem, "id" | "recipient_id">): GiftItem {
  return {
    profile_id: "profile-1",
    idea: "idea",
    selected_gift: "Gift",
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
  } as GiftItem;
}

describe("planner home stats", () => {
  it("uses real empty copy instead of invented progress", () => {
    const snapshot = buildPlannerSnapshot({
      profile: profile(),
      tasks: [] as PlannerTask[],
      recipients: [] as GiftRecipient[],
      gifts: [],
      budgetEntries: [],
      now: new Date("2026-11-01T10:00:00Z"),
    });
    expect(giftCardProgress(snapshot).text).toBe("No gifts yet");
    expect(mealCardProgress(snapshot).text).toBe("Plan your first meal");
    const cards = buildModuleCards({ snapshot, access: accessFromGrants({ grantKeys: [], seasonYear: 2026 }) });
    expect(cards.find((c) => c.id === "budget")?.progress).toBe("Set your Christmas budget");
    expect(cards.find((c) => c.id === "gifts")?.locked).toBe(false);
    expect(cards.find((c) => c.id === "travel")?.locked).toBe(true);
    expect(cards.find((c) => c.id === "meals")?.locked).toBe(true);
    const actions = collectHomeNextActions({ snapshot });
    expect(actions.map((a) => a.label)).toEqual(["Finish gift list", "Plan Christmas dinner", "Set your budget"]);
  });

  it("reports gift done counts from real statuses", () => {
    const snapshot = buildPlannerSnapshot({
      profile: profile({ total_budget_minor: 100000 }),
      tasks: [],
      recipients: [{ id: "r1", profile_id: "profile-1", display_name: "Dad", relationship: "family", budget_minor: 20000, notes: "" }],
      gifts: [
        gift({ id: "g1", recipient_id: "r1", status: "wrapped" }),
        gift({ id: "g2", recipient_id: "r1", status: "idea" }),
      ],
      budgetEntries: [],
      meals: [{ id: "m1", title: "Dinner", section: "christmas_day", meal_on: null }],
      now: new Date("2026-11-01T10:00:00Z"),
    });
    expect(giftCardProgress(snapshot).text).toBe("1 / 2 done");
    expect(mealCardProgress(snapshot).text).toBe("1 planned");
  });

  it("does not advertise Complete when founding pass is already granted", () => {
    const complete = accessFromGrants({
      grantKeys: [],
      seasonYear: 2026,
      orders: [{ product_key: "christmas_planner_2026", package_key: "founding_pass", payment_status: "paid" }],
    });
    expect(hasCompletePlanner(complete)).toBe(true);
    expect(showPlannerUpgrade(complete)).toBe(false);
    const free = accessFromGrants({ grantKeys: [], seasonYear: 2026 });
    expect(showPlannerUpgrade(free)).toBe(true);
    expect(hasFeature(free, "travel")).toBe(false);
  });
});

describe("planner home greeting and search", () => {
  it("uses timezone-aware day parts", () => {
    expect(dayGreetingWord(new Date("2026-12-01T09:00:00Z"), "UTC")).toBe("morning");
    expect(dayGreeting(new Date("2026-12-01T09:00:00Z"), "UTC", "Lauren")).toBe("Good morning, Lauren!");
    expect(firstNameFromAuthUser({ user_metadata: { full_name: "Lauren Blake" } })).toBe("Lauren");
  });

  it("searches real module routes only", () => {
    expect(searchPlannerModules("gift")[0]?.href).toBe("/account/christmas/gifts");
    expect(searchPlannerModules("xyz-nope")).toEqual([]);
    expect(moreRouteActive("/account/christmas/travel")).toBe(true);
    expect(moreRouteActive("/account/christmas/gifts")).toBe(false);
  });
});
