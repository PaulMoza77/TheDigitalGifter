import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  findStarterMatch,
  giftIdeaCount,
  itemsToBuyCount,
  missingStarterTasks,
  planProgress,
  STARTER_TASKS,
  taskMatchesStarter,
} from "./planSuggestions";

describe("starter Christmas plan suggestions", () => {
  it("matches existing generated titles so Add all cannot duplicate them", () => {
    const existing = [
      { title: "Set your total Christmas budget", template_key: "set_budget" },
      { title: "List everyone you’re gifting", template_key: "list_recipients" },
      { title: "Plan tree, lights, and table decor", template_key: "plan_decor" },
    ];
    expect(taskMatchesStarter(existing[0], STARTER_TASKS[0])).toBe(true);
    expect(taskMatchesStarter(existing[1], STARTER_TASKS[1])).toBe(true);
    expect(taskMatchesStarter(existing[2], STARTER_TASKS[3])).toBe(true);
    expect(missingStarterTasks(existing).map((row) => row.key)).toEqual(["decide_christmas_place"]);
    expect(findStarterMatch(existing, STARTER_TASKS[0])?.template_key).toBe("set_budget");
  });

  it("computes plan progress from real task statuses", () => {
    expect(planProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    expect(
      planProgress([
        { status: "open" },
        { status: "done" },
        { status: "skipped" },
        { status: "rescheduled" },
      ]),
    ).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it("counts gift ideas and items to buy from gift records", () => {
    const gifts = [
      { status: "idea" as const },
      { status: "planned" as const },
      { status: "ordered" as const },
      { status: "wrapped" as const },
    ];
    expect(giftIdeaCount(gifts)).toBe(4);
    expect(itemsToBuyCount(gifts)).toBe(2);
  });
});

describe("Tasks page copy and assets", () => {
  it("keeps the reference Tasks composition wired to live data", () => {
    const page = readFileSync("src/features/christmas/planner/PlanPage.tsx", "utf8");
    const css = readFileSync("src/features/christmas/planner/plannerApp.css", "utf8");
    expect(page).toContain("Everything you need to get Christmas done — without the last-minute stress.");
    expect(page).toContain("Your Christmas plan starts here");
    expect(page).toContain("Add all to my plan");
    expect(page).toContain("Not now, I’ll explore on my own");
    expect(page).toContain("No tasks for today yet.");
    expect(page).toContain("insertTasks");
    expect(page).toContain("missingStarterTasks");
    expect(page).toContain("/assets/christmas/cozy-reel/posters/clip1.jpg");
    expect(page).not.toContain("tdg-tasks-door");
    expect(page).not.toContain("🎁");
    expect(css).toContain(".tdg-tasks");
    expect(css).toContain(".tdg-tasks-hero-fade");
  });
});
