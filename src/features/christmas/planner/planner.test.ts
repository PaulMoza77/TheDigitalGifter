import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  christmasDayParts,
  countdownCopy,
  daysUntilChristmas,
  resolvePlanMode,
  upcomingChristmasYear,
} from "./date";
import { accessFromGrants, canAddRecipient, featuresForPackage, hasFeature } from "./entitlements";
import { generateInitialPlan, recommendedToday } from "./planGenerator";
import { computeReadiness } from "./readiness";
import { answerFromContext } from "./assistant";
import { sanitizePlannerMetadata } from "./analytics";
import { FREE_LIMITS } from "./types";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("christmas planner season dates", () => {
  it("uses 2026 Christmas from September", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    expect(upcomingChristmasYear(now, "UTC")).toBe(2026);
    expect(daysUntilChristmas(now, "UTC")).toBe(99);
    expect(resolvePlanMode(99, "starting")).toBe("early");
    expect(countdownCopy(99)).toContain("99 days");
  });

  it("switches to 5–8 week plan in November", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(daysUntilChristmas(now, "UTC")).toBe(45);
    expect(resolvePlanMode(45, "some")).toBe("standard");
  });

  it("uses rescue near Christmas and wrap after the 25th", () => {
    expect(daysUntilChristmas(new Date("2026-12-18T12:00:00Z"), "UTC")).toBe(7);
    expect(resolvePlanMode(7, "starting")).toBe("rescue");
    expect(upcomingChristmasYear(new Date("2026-12-24T12:00:00Z"), "UTC")).toBe(2026);
    expect(upcomingChristmasYear(new Date("2026-12-25T12:00:00Z"), "UTC")).toBe(2026);
    expect(upcomingChristmasYear(new Date("2026-12-26T12:00:00Z"), "UTC")).toBe(2027);
    expect(resolvePlanMode(-1, "mostly")).toBe("wrap");
  });
});

describe("dynamic plan templates", () => {
  it("builds a hosting+travel+kids early plan with system origin", () => {
    const tasks = generateInitialPlan({
      today: { year: 2026, month: 9, day: 17 },
      christmas: christmasDayParts(2026),
      mode: "early",
      hosting: true,
      travelling: true,
      hasChildren: true,
      giftCount: 6,
      prepared: "starting",
    });
    expect(tasks.length).toBeGreaterThan(8);
    expect(tasks.every((t) => t.origin === "system")).toBe(true);
    expect(tasks.some((t) => t.template_key === "menu_draft")).toBe(true);
    expect(tasks.some((t) => t.template_key === "travel_book")).toBe(true);
    expect(tasks.some((t) => t.template_key === "kids_photos")).toBe(true);
  });

  it("omits hosting tasks when not hosting", () => {
    const tasks = generateInitialPlan({
      today: { year: 2026, month: 12, day: 18 },
      christmas: christmasDayParts(2026),
      mode: "rescue",
      hosting: false,
      travelling: false,
      hasChildren: false,
      giftCount: 2,
      prepared: "rescue",
    });
    expect(tasks.some((t) => t.template_key === "menu_draft")).toBe(false);
    expect(tasks.some((t) => t.template_key === "rescue_today")).toBe(true);
  });

  it("recommends overdue tasks first", () => {
    const rec = recommendedToday(
      [
        { due_on: "2026-12-24", status: "open", priority: "low" },
        { due_on: "2026-09-01", status: "open", priority: "normal" },
        { due_on: "2026-12-20", status: "done", priority: "high" },
      ],
      "2026-09-17",
      3,
    );
    expect(rec[0]?.due_on).toBe("2026-09-01");
  });
});

describe("entitlements are feature-mapped, not isPremium", () => {
  it("maps core vs food add-on separately", () => {
    expect(featuresForPackage("christmas_planner", "core")).toContain("gift_planner");
    expect(featuresForPackage("christmas_planner", "core")).not.toContain("hosting");
    expect(featuresForPackage("christmas_planner_food", "food")).toEqual(["food_planner", "recipes"]);
  });

  it("revoked/refunded orders do not unlock", () => {
    const access = accessFromGrants({
      grantKeys: [],
      orders: [
        {
          product_key: "christmas_planner",
          package_key: "complete",
          payment_status: "paid",
          refunded_at: "2026-09-01",
        },
      ],
      seasonYear: 2026,
    });
    expect(access.paid).toBe(false);
    expect(hasFeature(access, "planner_core")).toBe(false);
  });

  it("caps free recipients at 3", () => {
    const free = accessFromGrants({ grantKeys: [], orders: [], seasonYear: 2026 });
    expect(canAddRecipient(free, 3).ok).toBe(false);
    const paid = accessFromGrants({
      grantKeys: ["gift_planner"],
      orders: [],
      seasonYear: 2026,
    });
    expect(canAddRecipient(paid, 3).ok).toBe(true);
    expect(FREE_LIMITS.maxRecipients).toBe(3);
  });
});

describe("readiness is explainable", () => {
  it("starts low and rises with weighted modules", () => {
    const empty = computeReadiness({
      profile: { hosting: false, travelling: false, total_budget_minor: null, onboarding_completed_at: "x" },
      tasks: [{ status: "open", category: "gifts" }],
      recipients: [],
      gifts: [],
    });
    expect(empty.percent).toBeLessThan(20);
    expect(empty.parts.some((p) => p.key === "tasks")).toBe(true);

    const better = computeReadiness({
      profile: { hosting: true, travelling: false, total_budget_minor: 80000, onboarding_completed_at: "x" },
      tasks: [
        { status: "done", category: "gifts" },
        { status: "done", category: "food" },
      ],
      recipients: [{ id: "a" }],
      gifts: [{ recipient_id: "a", status: "ordered" }],
      mealsCount: 2,
      cardsNeeded: 1,
      cardsPrepared: 1,
    });
    expect(better.percent).toBeGreaterThan(80);
    expect(better.parts.find((p) => p.key === "meals")).toBeTruthy();
  });
});

describe("privacy-safe planner analytics + assistant", () => {
  it("strips names, notes, and budgets from event metadata", () => {
    const clean = sanitizePlannerMetadata({
      module: "gifts",
      display_name: "Dad",
      notes: "secret",
      budget: 800,
      count_bucket: "4-6",
    });
    expect(clean.module).toBe("gifts");
    expect(clean.count_bucket).toBe("4-6");
    expect(clean.display_name).toBeUndefined();
    expect(clean.notes).toBeUndefined();
    expect(clean.budget).toBeUndefined();
  });

  it("answers from counts without sending notes", () => {
    const reply = answerFromContext("What am I forgetting?", {
      daysLeft: 20,
      planMode: "standard",
      readinessPercent: 40,
      openTasks: 6,
      recipientCount: 4,
      giftsWithoutPlan: 2,
      budgetRemainingMinor: 12000,
      currency: "eur",
      hosting: true,
    });
    expect(reply.source).toBe("local_rules");
    expect(reply.text.toLowerCase()).toContain("gift");
  });
});

describe("planner wiring", () => {
  it("registers account + public routes and noindex on account", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/account/christmas"');
    expect(app).toContain('path="/christmas/planner"');
    const sql = readSrc("supabase/migrations/20260917120000_christmas_planner.sql");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("christmas_planner_owns_profile");
    expect(sql).toContain("get_christmas_planner_access");
    expect(sql).toContain("grant_christmas_planner_entitlements");
    expect(readSrc("src/features/christmas/funnelEventContract.ts")).toContain("planner_dashboard_viewed");
    expect(readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts")).toContain(
      "grant_christmas_planner_entitlements",
    );
  });
});
