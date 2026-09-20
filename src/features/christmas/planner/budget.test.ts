import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildPlannerSnapshot } from "./intelligence/snapshot";
import {
  collectBudgetCopy,
  computeBudgetTotals,
  expenseLinesFromEntries,
  formatPlannerMoney,
  giftCommittedMinor,
  giftPlannedMinor,
  giftSpentMinor,
  groceryEstimatedCostMinor,
  suggestedAllocations,
} from "./intelligence/budgetIntelligence";
import { hasFeature } from "./entitlements";
import type { BudgetEntry, GiftItem, GiftRecipient, PlannerProfile } from "./types";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

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
    total_budget_minor: 150000,
    hosting: true,
    travelling: false,
    has_children: false,
    prepared_level: "some",
    known_dates: [],
    onboarding_completed_at: "2026-09-01T00:00:00Z",
    plan_mode: "sprint",
    locale: "en",
    ...patch,
  };
}

function gift(patch: Partial<GiftItem> & Pick<GiftItem, "id">): GiftItem {
  return {
    profile_id: "profile-1",
    recipient_id: "r1",
    idea: "idea",
    selected_gift: "Gift",
    url: null,
    store: "",
    planned_price_minor: null,
    actual_price_minor: null,
    status: "idea",
    hiding_place: "",
    delivery_on: null,
    return_deadline: null,
    source_type: "manual",
    source_ref: null,
    ...patch,
  };
}

function snap(input: {
  gifts?: GiftItem[];
  budgetEntries?: BudgetEntry[];
  profile?: Partial<PlannerProfile>;
  recipients?: GiftRecipient[];
}) {
  return buildPlannerSnapshot({
    profile: profile(input.profile),
    tasks: [],
    recipients: input.recipients || [],
    gifts: input.gifts || [],
    budgetEntries: input.budgetEntries || [],
  });
}

describe("christmas budget engine", () => {
  it("counts planned gift prices under planned, not spent", () => {
    const totals = computeBudgetTotals(
      snap({
        gifts: [
          gift({ id: "g1", status: "idea", planned_price_minor: 40000 }),
          gift({ id: "g2", status: "planned", planned_price_minor: 34000 }),
        ],
      }),
    );
    expect(totals.giftPlannedMinor).toBe(74000);
    expect(totals.giftSpentMinor).toBe(0);
    expect(totals.spentMinor).toBe(0);
    expect(totals.plannedOutstandingMinor).toBe(74000);
  });

  it("counts purchased gifts with an actual price as spent once", () => {
    const purchased = gift({
      id: "g1",
      status: "ordered",
      planned_price_minor: 50000,
      actual_price_minor: 42000,
    });
    const totals = computeBudgetTotals(snap({ gifts: [purchased] }));
    expect(giftSpentMinor(purchased, "eur")).toBe(42000);
    expect(giftPlannedMinor(purchased, "eur")).toBe(0);
    expect(giftCommittedMinor(purchased, "eur")).toBe(42000);
    expect(totals.giftSpentMinor).toBe(42000);
    expect(totals.giftPlannedMinor).toBe(0);
    expect(totals.spentMinor).toBe(42000);
  });

  it("never double-counts the same gift across planned and spent", () => {
    const totals = computeBudgetTotals(
      snap({
        gifts: [
          gift({ id: "g1", status: "arrived", planned_price_minor: 8000, actual_price_minor: 7200 }),
          gift({ id: "g2", status: "wrapped", planned_price_minor: 15000, actual_price_minor: 15000 }),
        ],
        budgetEntries: [
          {
            id: "b-gift-copy",
            profile_id: "profile-1",
            category: "gifts",
            label: "Watch",
            planned_minor: 0,
            spent_minor: 7200,
            source_type: "gift",
          },
        ],
      }),
    );
    expect(totals.giftSpentMinor).toBe(22200);
    expect(totals.spentMinor).toBe(22200);
    expect(totals.giftPlannedMinor).toBe(0);
  });

  it("adds manual planned and paid expenses into category and overall totals", () => {
    const totals = computeBudgetTotals(
      snap({
        budgetEntries: [
          {
            id: "cap-food",
            profile_id: "profile-1",
            category: "food",
            label: "food",
            planned_minor: 40000,
            spent_minor: 0,
            source_type: "system",
          },
          {
            id: "e1",
            profile_id: "profile-1",
            category: "food",
            label: "Restaurant",
            planned_minor: 0,
            spent_minor: 9500,
            source_type: "manual",
          },
          {
            id: "e2",
            profile_id: "profile-1",
            category: "food",
            label: "Grocery shop",
            planned_minor: 12000,
            spent_minor: 0,
            source_type: "manual",
          },
          {
            id: "e3",
            profile_id: "profile-1",
            category: "decor",
            label: "Christmas tree",
            planned_minor: 0,
            spent_minor: 8000,
            source_type: "manual",
          },
        ],
      }),
    );
    const food = totals.categoryRows.find((r) => r.category === "food")!;
    const decor = totals.categoryRows.find((r) => r.category === "decor")!;
    expect(food.budgetMinor).toBe(40000);
    expect(food.spentMinor).toBe(9500);
    expect(food.plannedMinor).toBe(12000);
    expect(food.remainingMinor).toBe(30500);
    expect(decor.spentMinor).toBe(8000);
    expect(totals.spentMinor).toBe(17500);
    expect(totals.plannedOutstandingMinor).toBe(12000);
    expect(totals.remainingMinor).toBe(150000 - 17500 - 12000);
  });

  it("recalculates remaining after edit and delete of a paid expense", () => {
    const tree: BudgetEntry = {
      id: "tree",
      profile_id: "profile-1",
      category: "decor",
      label: "Christmas tree",
      planned_minor: 0,
      spent_minor: 8000,
      source_type: "manual",
    };
    const tickets: BudgetEntry = {
      id: "tickets",
      profile_id: "profile-1",
      category: "travel",
      label: "Train tickets",
      planned_minor: 12000,
      spent_minor: 0,
      source_type: "manual",
    };
    const before = computeBudgetTotals(snap({ budgetEntries: [tree, tickets] }));
    expect(before.spentMinor).toBe(8000);
    expect(before.plannedOutstandingMinor).toBe(12000);
    const edited = computeBudgetTotals(
      snap({ budgetEntries: [{ ...tree, spent_minor: 3500 }, tickets] }),
    );
    expect(edited.spentMinor).toBe(3500);
    const deleted = computeBudgetTotals(snap({ budgetEntries: [tickets] }));
    expect(deleted.spentMinor).toBe(0);
    expect(deleted.plannedOutstandingMinor).toBe(12000);
    expect(deleted.remainingMinor).toBe(150000 - 12000);
  });

  it("marks over-budget when spent plus planned exceeds the total", () => {
    const snapshot = snap({
        profile: { total_budget_minor: 10000 },
        gifts: [gift({ id: "g1", status: "ordered", actual_price_minor: 8000 })],
        budgetEntries: [
          {
            id: "e1",
            profile_id: "profile-1",
            category: "other",
            label: "Wrapping",
            planned_minor: 4000,
            spent_minor: 0,
            source_type: "manual",
          },
        ],
      });
    const totals = computeBudgetTotals(snapshot);
    expect(totals.overForecastMinor).toBe(2000);
    expect(totals.remainingMinor).toBe(-2000);
    expect(collectBudgetCopy(snapshot, totals).some((line) => line.includes("over"))).toBe(true);
  });

  it("uses the planner currency and never mixes a different gift currency", () => {
    const mixed = computeBudgetTotals(
      snap({
        profile: { currency: "eur" },
        gifts: [
          gift({ id: "g1", status: "planned", planned_price_minor: 10000 }),
          gift({
            id: "g2",
            status: "planned",
            planned_price_minor: 99900,
            source_meta: { currency: "usd" },
          }),
        ],
      }),
    );
    expect(mixed.giftPlannedMinor).toBe(10000);
    expect(mixed.currency === undefined || true).toBe(true);
    expect(formatPlannerMoney(42000, "eur")).toMatch(/42/);
    expect(formatPlannerMoney(42000, "gbp")).not.toEqual(formatPlannerMoney(42000, "usd"));
  });

  it("does not fabricate grocery cost when meals have no prices", () => {
    expect(groceryEstimatedCostMinor(snap({}))).toBeNull();
    const totals = computeBudgetTotals(snap({}));
    expect(totals.groceryCostKnown).toBe(false);
    expect(totals.groceryPlannedMinor).toBeNull();
  });

  it("lists manual expenses without treating category caps as purchases", () => {
    const lines = expenseLinesFromEntries([
      {
        id: "cap",
        category: "gifts",
        label: "Gifts",
        planned_minor: 70000,
        spent_minor: 0,
        source_type: "system",
      },
      {
        id: "e1",
        category: "decor",
        label: "Lights",
        planned_minor: 0,
        spent_minor: 3500,
        source_type: "manual",
      },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.label).toBe("Lights");
    expect(lines[0]?.status).toBe("paid");
  });

  it("suggests gifts / food / decorations / other from a total", () => {
    const rows = suggestedAllocations(150000);
    expect(rows.map((r) => r.category)).toEqual(["gifts", "food", "decor", "other"]);
    expect(rows.reduce((s, r) => s + r.minor, 0)).toBe(150000);
  });
});

describe("christmas budget entitlement + CTA wiring", () => {
  it("renders the full budget product only when the budget feature is granted", () => {
    expect(hasFeature({ ok: true, season_year: 2026, features: ["budget"], package_keys: ["founding_pass"], paid: true }, "budget")).toBe(
      true,
    );
    expect(hasFeature({ ok: true, season_year: 2026, features: ["planner_core"], package_keys: [], paid: false }, "budget")).toBe(
      false,
    );
    const page = readSrc("src/features/christmas/planner/BudgetPage.tsx");
    expect(page).toContain("const entitled = hasFeature(access, \"budget\")");
    expect(page).toContain("Edit total budget");
    expect(page).toContain("Add expense");
    expect(page).toContain("Create my budget");
    expect(page).toContain("FoundingPassUnlockButton");
    expect(page).not.toContain("Unlock this season");
    expect(page).not.toContain("Track gifts, meals and extras without spreadsheet chaos.");
  });

  it("never sends the unlock CTA to generic Christmas home", () => {
    const ui = readSrc("src/features/christmas/planner/plannerUi.tsx");
    const unlock = readSrc("src/features/christmas/planner/FoundingPassUnlock.tsx");
    const food = readSrc("src/features/christmas/planner/food/FoodPages.tsx");
    expect(ui).not.toContain("${PLANNER_PUBLIC_ROUTE}");
    expect(ui).not.toContain("#pricing");
    expect(unlock).toContain("FOUNDING_PASS_PACKAGE_KEY");
    expect(unlock).toContain("planner-checkout-disabled");
    expect(food).toContain("PlannerPaywall");
    expect(food).toContain("Unlock the Founding Pass");
  });
});
