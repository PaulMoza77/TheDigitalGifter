import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeCompatibleQuantity, planManualGroceryAdd } from "@/features/occasions/grocerySync";
import { attentionWithoutDuplicates } from "./intelligence/recommendations";
import { giftPeopleLimit, giftPeopleLimitCopy, isHouseholdGiftList } from "./giftPeople";
import { recommendedToday } from "./planGenerator";
import { plannerTodayIso, plannerWeekEndIso, taskWhen, tasksForView } from "./taskSchedule";
import type { PlannerAccess } from "./types";

const free: PlannerAccess = {
  ok: true,
  season_year: 2026,
  features: [],
  package_keys: [],
  paid: false,
  payment_fulfilled: false,
  access_source: "free",
};

describe("Today and Tasks share timezone date buckets", () => {
  const now = new Date("2026-09-22T06:30:00Z");

  it("uses the profile calendar day, not a 7-day millisecond jump", () => {
    expect(plannerTodayIso(now, "America/Los_Angeles")).toBe("2026-09-21");
    expect(plannerWeekEndIso(now, "America/Los_Angeles")).toBe("2026-09-27");
    expect(plannerTodayIso(now, "UTC")).toBe("2026-09-22");
    expect(plannerWeekEndIso(now, "UTC")).toBe("2026-09-28");
  });

  it("separates overdue, today, this week, and later", () => {
    const today = "2026-09-21";
    const weekEnd = "2026-09-27";
    const rows = [
      { id: "over", status: "open", due_on: "2026-09-20" },
      { id: "today", status: "rescheduled", due_on: "2026-09-21" },
      { id: "week", status: "open", due_on: "2026-09-26" },
      { id: "later", status: "open", due_on: "2026-12-01" },
      { id: "undated", status: "open", due_on: null },
      { id: "done", status: "done", due_on: "2026-09-21" },
    ];
    expect(rows.map((row) => taskWhen(row, today, weekEnd))).toEqual([
      "overdue",
      "today",
      "week",
      "later",
      "later",
      "done",
    ]);
    expect(tasksForView(rows, "today", today, weekEnd).map((row) => row.id)).toEqual(["over", "today"]);
    expect(tasksForView(rows, "week", today, weekEnd).map((row) => row.id)).toEqual(["over", "today", "week"]);
    const priorities = recommendedToday(rows, today, 3, weekEnd);
    expect(priorities.map((row) => row.id)).toEqual(["over", "today", "week"]);
  });
});

describe("free gift people", () => {
  it("does not count Household and keeps people already over the cap", () => {
    const recipients = [
      { display_name: "A" },
      { display_name: "B" },
      { display_name: "C" },
      { display_name: "Household" },
    ];
    const atCap = giftPeopleLimit(free, recipients);
    expect(isHouseholdGiftList(recipients[3])).toBe(true);
    expect(atCap.giftPeople).toBe(3);
    expect(atCap.householdCount).toBe(1);
    expect(atCap.canAdd).toBe(false);
    expect(atCap.overExisting).toBe(false);
    expect(giftPeopleLimitCopy(atCap)).toContain("3 gift people");
    expect(giftPeopleLimitCopy(atCap)).toContain("Household");

    const grandfathered = giftPeopleLimit(free, [
      { display_name: "A" },
      { display_name: "B" },
      { display_name: "C" },
      { display_name: "D" },
    ]);
    expect(grandfathered.giftPeople).toBe(4);
    expect(grandfathered.overExisting).toBe(true);
    expect(grandfathered.canAdd).toBe(false);
    expect(giftPeopleLimitCopy(grandfathered)).toContain("they stay");
  });
});

describe("grocery additions", () => {
  it("merges compatible units and refuses a second row", () => {
    expect(mergeCompatibleQuantity("200 g", "1 kg")).toBe("1.2 kg");
    expect(mergeCompatibleQuantity("250 ml", "1 l")).toBe("1.25 l");
    const first = planManualGroceryAdd({
      items: [],
      aisle: "dairy",
      label: "Milk",
      quantity: "1 l",
    });
    expect(first.action).toBe("insert");
    const second = planManualGroceryAdd({
      items: [{ id: "1", name: "dairy|Milk", quantity: "1 l" }],
      aisle: "dairy",
      label: "milk",
      quantity: "250 ml",
    });
    expect(second).toEqual({ action: "merge", id: "1", quantity: "1.25 l" });
    const blocked = planManualGroceryAdd({
      items: [{ id: "1", name: "dairy|Milk", quantity: "1 l" }],
      aisle: "dairy",
      label: "Milk",
      quantity: "2 cups",
    });
    expect(blocked.action).toBe("duplicate");
  });
});

describe("recommendation duplicates", () => {
  it("drops the card that repeats the next action", () => {
    const action = {
      id: "insight:gifts.missing_ideas",
      title: "Choose gift ideas",
      reason: "Two people still need a gift.",
      score: 10,
      href: "/account/christmas/gifts",
      actionType: "open_module" as const,
      actionPayload: {},
      category: "gifts" as const,
    };
    const insights = [
      {
        id: "gifts.missing_ideas",
        type: "gift_coverage" as const,
        severity: "suggestion" as const,
        category: "gifts" as const,
        title: "2 gifts still need an idea",
        body: "body",
        reason: "reason",
        recommendedAction: "Choose gift ideas",
        actionType: "open_module" as const,
        actionPayload: { href: "/account/christmas/gifts" },
        dueDate: null,
        priority: 1,
        dismissible: false,
        autoResolvable: true,
        notifyEligible: false,
        notifyAfter: null,
        urgency: "suggestion" as const,
        dedupeKey: "gifts.missing_ideas",
      },
    ];
    expect(attentionWithoutDuplicates(insights, action)).toEqual([]);
  });
});

describe("QA access is not a payment", () => {
  it("never writes an order or a paid status", () => {
    const sql = readFileSync("supabase/migrations/20260921193000_christmas_planner_qa_access.sql", "utf8");
    const grant = sql.slice(sql.indexOf("function public.grant_christmas_planner_qa_access"), sql.indexOf("function public.revoke_christmas_planner_qa_access"));
    expect(grant).toContain("payment_fulfilled");
    expect(grant).toContain("raw_app_meta_data->>'planner_qa'");
    expect(grant).not.toContain("user_metadata");
    expect(grant).not.toContain("christmas_orders");
    expect(grant).not.toContain("payment_status");
    expect(sql).toContain("revoke all on function public.grant_christmas_planner_qa_access(uuid, text, integer) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.grant_christmas_planner_qa_access(uuid, text, integer) to service_role");
    expect(sql).toContain("free_recipient_limit");
    expect(sql).toContain("household_list_exists");
    expect(sql).toContain("before insert or update");
    expect(sql).not.toContain("raw_user_meta_data");
    const pages = readFileSync("src/features/christmas/planner/ChristmasPlannerPages.tsx", "utf8");
    const unlock = readFileSync("src/features/christmas/planner/FoundingPassUnlock.tsx", "utf8");
    const copilot = readFileSync("src/features/christmas/planner/copilot/CopilotSheet.tsx", "utf8");
    const insights = readFileSync("src/features/christmas/planner/intelligence/insights.ts", "utf8");
    expect(pages).not.toContain("Engine facts");
    expect(insights).not.toContain("Gift coverage is measured");
    expect(copilot).not.toContain("Engine facts");
    expect(unlock).toContain("Get my Christmas Planner");
    expect(pages).not.toContain("Core unlocks");
  });
});
