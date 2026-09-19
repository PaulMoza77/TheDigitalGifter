import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sanitizePlannerMetadata } from "../analytics";
import { buildIntelligence } from "../intelligence";
import { askCopilot, copilotLlmEnabled } from "./ask";
import { applyCopilotPlan, confirmationClassFor, isWriteTool } from "./registry";

function fixture() {
  return buildIntelligence({
    seasonYear: 2026,
    todayIso: "2026-12-12",
    daysLeft: 13,
    planMode: "sprint",
    readinessPercent: 41,
    hosting: true,
    travelling: true,
    hasChildren: false,
    currency: "eur",
    tasks: [
      { id: "1", title: "Order shipped gifts", status: "open", priority: "high", due_on: "2026-12-10", category: "shopping" },
      { id: "2", title: "Wrap remaining gifts", status: "open", priority: "low", due_on: "2026-12-24", category: "gifts" },
      { id: "3", title: "Do the main grocery shop", status: "open", priority: "high", due_on: "2026-12-13", category: "food" },
    ],
    recipients: [
      { id: "r1", display_name: "Dad" },
      { id: "r2", display_name: "Maya" },
    ],
    gifts: [{ recipient_id: "r2", status: "planned" }],
    budgetPlannedMinor: 80000,
    budgetSpentMinor: 30000,
    mealsCount: 0,
    groceryNeedCount: 2,
    tripStartOn: "2026-12-22",
  });
}

describe("planner intelligence snapshot", () => {
  it("counts missing gifts, overdue tasks, and trip pressure without notes", () => {
    const bundle = fixture();
    expect(bundle.snapshot.giftsWithoutPlan).toBe(1);
    expect(bundle.snapshot.missingGiftNames).toEqual(["Dad"]);
    expect(bundle.snapshot.overdueTasks).toBe(1);
    expect(bundle.snapshot.tripStartOn).toBe("2026-12-22");
    expect(bundle.insights.some((i) => i.kind === "missing_gifts")).toBe(true);
    expect(bundle.insights.some((i) => i.kind === "no_menu")).toBe(true);
    expect(bundle.insights.some((i) => i.kind === "trip_deadline")).toBe(true);
    expect(JSON.stringify(bundle)).not.toMatch(/hiding_place|booking_notes|@/);
  });
});

describe("christmas copilot P0", () => {
  it("answers weekend, gaps, budget, dad, dinner, travel, grocery, rescue, ignore from the engine", () => {
    const bundle = fixture();
    const weekend = askCopilot("What should I do this weekend?", bundle);
    expect(weekend.modelPath).toBe("deterministic");
    expect(weekend.requiresConfirmation).toBe(false);
    expect(weekend.suggestedActions).toEqual([]);
    expect(weekend.message.toLowerCase()).toMatch(/task|grocery|order/);

    const forget = askCopilot("What am I forgetting?", bundle);
    expect(forget.message.toLowerCase()).toMatch(/gift|menu|overdue|travel/);

    const budget = askCopilot("I only have €500 left.", bundle);
    expect(budget.cards.some((c) => c.type === "budget_summary")).toBe(true);

    const dad = askCopilot("Dad still needs a gift.", bundle);
    expect(dad.message).toContain("Dad");

    const dinner = askCopilot("We have 10 people for dinner.", bundle);
    expect(dinner.message.toLowerCase()).toMatch(/hosting|10/);
    expect(dinner.unsupported?.asked).toBe("add_meal");

    const travel = askCopilot("I’m travelling on Dec 22.", bundle);
    expect(travel.message).toContain("2026-12-22");

    const move = askCopilot("Move my important tasks earlier.", bundle);
    expect(move.unsupported?.reason).toBe("no_tool");

    const grocery = askCopilot("Give me a grocery list.", bundle);
    expect(grocery.message.toLowerCase()).toMatch(/grocery|meal/);

    const behind = askCopilot("I’m completely behind.", bundle);
    expect(behind.tone).toBe("rescue");

    const ignore = askCopilot("What can I safely ignore?", bundle);
    expect(ignore.message.toLowerCase()).toMatch(/wrap remaining gifts|skip/);
  });

  it("never enables the LLM path or apply in P0", () => {
    expect(copilotLlmEnabled()).toBe(false);
    const applied = applyCopilotPlan();
    expect(applied.ok).toBe(false);
    if (!applied.ok) expect(applied.code).toBe("not_implemented");
    expect(confirmationClassFor("reschedule_task", 3)).toBe("bulk");
    expect(isWriteTool("create_task")).toBe(true);
    expect(isWriteTool("read_snapshot")).toBe(false);
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
    expect(clean.notes).toBeUndefined();
  });
});

describe("copilot wiring is local-only", () => {
  it("does not add a production LLM edge function in this release", () => {
    const layout = readFileSync(resolve(process.cwd(), "src/features/christmas/planner/ChristmasPlannerLayout.tsx"), "utf8");
    expect(layout).toContain("CopilotHost");
    const ask = readFileSync(resolve(process.cwd(), "src/features/christmas/planner/copilot/ask.ts"), "utf8");
    expect(ask).not.toContain("api.openai.com");
    expect(ask).toContain('return false');
  });
});
