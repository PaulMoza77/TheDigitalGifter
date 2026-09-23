import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { invalidatePlannerQueries, peekPlannerQuery, plannerQuery } from "./plannerQueryCache";

describe("planner query cache", () => {
  it("reuses an in-flight request and a fresh result for the same key", async () => {
    let calls = 0;
    const key = `tasks:cache-test-${Date.now()}`;
    const load = () =>
      plannerQuery(key, async () => {
        calls += 1;
        return ["a"];
      });
    const [first, second] = await Promise.all([load(), load()]);
    expect(first).toEqual(["a"]);
    expect(second).toEqual(["a"]);
    expect(calls).toBe(1);
    expect(peekPlannerQuery<string[]>(key)).toEqual(["a"]);
    await load();
    expect(calls).toBe(1);
  });

  it("does not keep a result that was invalidated while loading", async () => {
    const profileId = `profile-${Date.now()}`;
    const key = `gifts:${profileId}`;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = plannerQuery(key, async () => {
      await gate;
      return ["stale"];
    });
    invalidatePlannerQueries(profileId);
    release();
    await pending;
    expect(peekPlannerQuery(key)).toBeUndefined();
  });
});

describe("planner navigation does not refetch the shared workspace", () => {
  it("keeps shell readiness off the route and loads only recipes the menu uses", () => {
    const layout = readFileSync("src/features/christmas/planner/ChristmasPlannerLayout.tsx", "utf8");
    const copilot = readFileSync("src/features/christmas/planner/copilot/CopilotHost.tsx", "utf8");
    const snapshot = readFileSync("src/features/christmas/planner/intelligence/loadSnapshot.ts", "utf8");
    const recipes = readFileSync("src/features/christmas/planner/food/FoodPages.tsx", "utf8");
    expect(layout).toContain("}, [profile]);");
    expect(layout).toContain("<Suspense");
    expect(layout).not.toContain("invalidatePlannerSnapshot(current.id)");
    expect(copilot).not.toContain("}, [profile, location.pathname]);");
    expect(snapshot).toContain('.in("id", recipeIds)');
    expect(snapshot).not.toContain('.eq("published", true)');
    expect(snapshot).toContain("inflight?.promise === promise");
    expect(recipes).toContain("loadPublishedRecipeList");
    expect(recipes).toContain("Show more recipes");
    expect(recipes).not.toContain("RECIPE_SELECT");
    const onboarding = readFileSync("src/features/christmas/planner/Onboarding.tsx", "utf8");
    expect(onboarding).toContain('event === "SIGNED_OUT"');
    expect(onboarding).toContain("invalidatePlannerSnapshot");
  });
});
