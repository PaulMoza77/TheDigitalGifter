import { classifyAssistantIntent } from "../assistant";
import { formatPlannerMoney } from "../intelligence/budgetIntelligence";
import type { PlannerIntelligence, PlannerInsight } from "../intelligence/types";
import { applyCopilotPlan, type ApplyPlanResult } from "./registry";
import { proposeCopilotPlan, type CopilotActionPlan, type CopilotPlanStep } from "./plan";

export type CopilotCard =
  | { type: "insight"; title: string; body: string; href?: string }
  | { type: "task_list"; title: string; items: string[] }
  | { type: "budget_summary"; planned: string; spent: string; remaining: string }
  | { type: "meal_plan"; title: string; body: string };

export type CopilotResponse = {
  message: string;
  tone: "steady" | "rescue" | "celebrate";
  insightsUsed: Array<{ id: string; kind: string; module: string }>;
  nextBestActions: Array<{ id: string; label: string; href?: string }>;
  suggestedActions: CopilotPlanStep[];
  actionPlan: CopilotActionPlan | null;
  requiresConfirmation: boolean;
  followUpOptions: string[];
  cards: CopilotCard[];
  modelPath: "deterministic" | "fallback";
  snapshotVersion: string;
  unsupported?: { asked: string; reason: "no_tool" | "forbidden" | "ambiguous" };
};

const WRITE_HINT =
  "I can preview a change. Nothing is written until you confirm.";

function progressedGift(status: string): boolean {
  return ["planned", "ordered", "arrived", "hidden", "wrapped", "given"].includes(status);
}

function missingGiftNames(intel: PlannerIntelligence): string[] {
  const done = new Set(
    intel.snapshot.gifts.filter((g) => progressedGift(g.status)).map((g) => g.recipient_id),
  );
  return intel.snapshot.recipients.filter((r) => !done.has(r.id)).map((r) => r.display_name).slice(0, 6);
}

function insightCards(insights: PlannerInsight[], types?: string[]): CopilotCard[] {
  const picked = types ? insights.filter((i) => types.includes(i.type) || types.includes(i.category)) : insights.slice(0, 3);
  return picked.slice(0, 3).map((i) => ({
    type: "insight" as const,
    title: i.title,
    body: i.body,
    href: typeof i.actionPayload.href === "string" ? i.actionPayload.href : undefined,
  }));
}

export function copilotEnabled(): boolean {
  const raw = String(import.meta.env.VITE_CHRISTMAS_PLANNER_COPILOT ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

export function copilotLlmEnabled(): boolean {
  return false;
}

export function snapshotVersionFromIntel(intel: PlannerIntelligence): string {
  return [
    intel.snapshot.today,
    intel.readiness.percent,
    intel.insights.length,
    intel.snapshot.tasks.length,
    intel.travelConflicts.length,
  ].join(":");
}

export function askCopilot(question: string, intel: PlannerIntelligence): CopilotResponse {
  const q = question.trim().slice(0, 240);
  const lower = q.toLowerCase();
  const intent = classifyAssistantIntent(q);
  const { snapshot, insights, nextBestAction, readiness, rescue, budget, todayPriorities, travelConflicts, grocery } = intel;
  const missing = missingGiftNames(intel);
  const money = (n: number) => formatPlannerMoney(n, snapshot.currency);
  const tone = rescue.active ? "rescue" : readiness.percent >= 80 ? "celebrate" : "steady";
  const nbas = nextBestAction
    ? [{ id: nextBestAction.id, label: nextBestAction.title, href: nextBestAction.href }]
    : [];
  const weekendTitles = todayPriorities.map((t) => t.title).slice(0, 5);
  const overdueTitles = snapshot.tasks
    .filter((t) => (t.status === "open" || t.status === "rescheduled") && t.due_on && t.due_on < snapshot.today)
    .map((t) => t.title)
    .slice(0, 5);
  const skipTitles = snapshot.tasks
    .filter((t) => rescue.deprioritizedTaskIds.includes(t.id))
    .map((t) => t.title)
    .slice(0, 5);
  const trip = snapshot.trips.map((t) => t.start_on).filter(Boolean).sort()[0] || null;
  const groceryNeed = grocery.filter((g) => g.status === "need").length;

  const snapshotVersion = snapshotVersionFromIntel(intel);
  const proposedPlan = proposeCopilotPlan(q, intel, snapshotVersion);
  const base = (): Omit<CopilotResponse, "message" | "cards" | "followUpOptions" | "unsupported"> => ({
    tone,
    insightsUsed: insights.slice(0, 4).map((i) => ({ id: i.id, kind: i.type, module: i.category })),
    nextBestActions: nbas,
    suggestedActions: proposedPlan?.steps || [],
    actionPlan: proposedPlan,
    requiresConfirmation: Boolean(proposedPlan?.steps.length),
    modelPath: "deterministic",
    snapshotVersion,
  });

  if (lower.includes("ignore") || lower.includes("safely ignore") || (lower.includes("skip") && lower.includes("task"))) {
    return {
      ...base(),
      message: skipTitles.length
        ? `You can safely leave these for later: ${skipTitles.join("; ")}. Don’t skip shipping gifts, travel start, or dinner if you’re hosting.`
        : "Nothing looks skippable from the Intelligence Engine. Low-priority far-dated work will show up here in rescue/sprint.",
      cards: [
        { type: "task_list", title: "Safe to ignore", items: skipTitles.length ? skipTitles : ["No deprioritized tasks"] },
        ...insightCards(insights, ["tasks"]),
      ],
      followUpOptions: ["What should I do this weekend?", "Give me a rescue plan."],
    };
  }

  if (lower.includes("grocery") || lower.includes("shopping list") || (lower.includes("list") && lower.includes("food"))) {
    return {
      ...base(),
      message: snapshot.profile.hosting
        ? snapshot.meals.length
          ? `You have ${snapshot.meals.length} ${snapshot.meals.length === 1 ? "meal" : "meals"} and ${groceryNeed} grocery ${groceryNeed === 1 ? "row" : "rows"} still marked need. Open Grocery to tick them — I won’t invent ingredients from private notes.`
          : "Add Christmas Eve or Day in Food first, then the Engine can merge a grocery list."
        : "You’re not marked as hosting. Turn hosting on in Settings if you need a dinner grocery list.",
      cards: insightCards(insights, ["food"]),
      followUpOptions: ["Create a dinner plan for 8.", "What am I forgetting?"],
      unsupported: { asked: "add_grocery_item", reason: "no_tool" },
    };
  }

  if (lower.includes("travel") || lower.includes("leaving") || lower.includes("trip") || /\bdec(ember)?\s*22\b/.test(lower)) {
    return {
      ...base(),
      message: trip
        ? `Travel on the plan starts ${trip}. ${travelConflicts.length} ${travelConflicts.length === 1 ? "task conflicts" : "tasks conflict"} with that date. ${WRITE_HINT}`
        : "No trip is saved yet. Add dates in Travel (no passport or booking secrets). Then I can list what should finish before you leave.",
      cards: travelConflicts.length
        ? [{ type: "task_list", title: "Move before the trip", items: travelConflicts.slice(0, 5).map((c) => `${c.title} → ${c.suggestedDate}`) }]
        : insightCards(insights, ["travel"]),
      followUpOptions: ["Move my important tasks earlier.", "What should I do this weekend?"],
      unsupported: trip ? { asked: "reschedule_task", reason: "no_tool" } : undefined,
    };
  }

  if (lower.includes("move") && (lower.includes("earlier") || lower.includes("before") || lower.includes("task"))) {
    return {
      ...base(),
      message: travelConflicts.length
        ? `The Engine already computed ${travelConflicts.length} safer dates. Confirm them on Today’s travel sheet, or wait for Copilot apply. ${WRITE_HINT}`
        : `${WRITE_HINT} Open Plan to change dates.`,
      cards: travelConflicts.length
        ? [{ type: "task_list", title: "Proposed moves", items: travelConflicts.slice(0, 5).map((c) => `${c.title} → ${c.suggestedDate}`) }]
        : insightCards(insights, ["travel", "tasks"]),
      followUpOptions: ["I’m travelling on Dec 22.", "What should I do this weekend?"],
      unsupported: { asked: "reschedule_task", reason: "no_tool" },
    };
  }

  if (lower.includes("behind") || lower.includes("completely") || intent === "rescue") {
    const focus = [...overdueTitles, ...weekendTitles].slice(0, 3);
    return {
      ...base(),
      tone: "rescue",
      message: rescue.active
        ? `Rescue is on (${snapshot.daysLeft} days). ${rescue.reason} Start with: ${focus.join("; ") || "gifts that must ship, food shop, wrap"}.`
        : `You’re ${readiness.percent}% ready. Treat it as rescue: three things only — gifts that must ship, food shop, wrap.`,
      cards: [
        { type: "task_list", title: "Rescue focus", items: focus.length ? focus : ["Pick three things that still matter"] },
        ...insightCards(insights.filter((i) => i.severity === "urgent" || i.severity === "important")),
      ],
      followUpOptions: ["What gifts am I still missing?", "What can I safely ignore?"],
    };
  }

  if (intent === "missing_gifts" || (lower.includes("dad") && lower.includes("gift")) || lower.includes("who still")) {
    const dad = missing.find((n) => /dad|father|papa|tata/i.test(n));
    const askedDad = lower.includes("dad") || lower.includes("father");
    const message = askedDad
      ? dad
        ? `${dad} is on the list without a planned gift. Open Gifts and use Need an idea? — I don’t invent gifts from private notes.`
        : missing.length
          ? `I don’t see a “Dad” label still missing a plan. Still open: ${missing.join(", ")}.`
          : "Every person on your gift list has at least one planned gift."
      : missing.length
        ? `${missing.length} ${missing.length === 1 ? "person still needs" : "people still need"} a planned gift: ${missing.join(", ")}.`
        : "Every person on your gift list has at least one planned gift.";
    return {
      ...base(),
      message,
      cards: insightCards(insights, ["gifts"]),
      followUpOptions: ["What should I do this weekend?", "Am I over budget?"],
    };
  }

  if (intent === "budget" || lower.includes("€") || (lower.includes("left") && lower.includes("500"))) {
    if (budget.remainingMinor == null && !snapshot.profile.totalBudgetMinor) {
      return {
        ...base(),
        message: "Set a season budget in Budget, then I can tell you if you’re on track — without sending amounts to ads.",
        cards: insightCards(insights, ["budget"]),
        followUpOptions: ["What am I forgetting?", "What gifts am I still missing?"],
      };
    }
    const remaining = budget.remainingAfterSpendMinor ?? budget.remainingMinor;
    const over = insights.find((i) => i.id === "budget.forecast_over" || i.id.startsWith("budget.category_over"));
    return {
      ...base(),
      message: over
        ? over.body
        : remaining != null
          ? `You have ${money(remaining)} left. Spent ${money(budget.spentMinor)}${
              budget.plannedOutstandingMinor > 0
                ? `, with ${money(budget.plannedOutstandingMinor)} still planned.`
                : "."
            }`
          : "Budget is set. Open Budget for the category split.",
      cards: [
        {
          type: "budget_summary",
          planned: money(snapshot.profile.totalBudgetMinor || budget.forecastMinor),
          spent: money(budget.spentMinor),
          remaining: remaining != null ? money(remaining) : "—",
        },
        ...insightCards(insights, ["budget"]),
      ],
      followUpOptions: ["What gifts am I still missing?", "What can I safely ignore?"],
    };
  }

  if (intent === "dinner" || (lower.includes("people") && lower.includes("dinner")) || lower.includes("for 10") || lower.includes("for 8")) {
    const head = lower.match(/for\s+(\d+)/)?.[1];
    return {
      ...base(),
      message: snapshot.profile.hosting
        ? `You’re hosting. ${head ? `For ${head} people: ` : ""}set servings on Christmas Day in Food, add dishes, then send ingredients to Grocery. ${WRITE_HINT}`
        : "You’re not marked as hosting. Turn hosting on in Settings if you need a dinner plan.",
      cards: [
        {
          type: "meal_plan",
          title: "Christmas dinner",
          body: snapshot.meals.length
            ? `${snapshot.meals.length} meals already on the plan.`
            : "Eve + Day menus are the fastest hosting win.",
        },
        ...insightCards(insights, ["food", "hosting"]),
      ],
      followUpOptions: ["Give me a grocery list.", "What am I forgetting?"],
      unsupported: { asked: "add_meal", reason: "no_tool" },
    };
  }

  if (intent === "forgetting") {
    const bits = insights.filter((i) => i.severity !== "info").slice(0, 4).map((i) => i.body);
    return {
      ...base(),
      message: bits.length ? `Likely gaps: ${bits.join(" ")}` : "No obvious gaps from the Intelligence Engine.",
      cards: insightCards(insights),
      followUpOptions: ["What should I do this weekend?", "Give me a rescue plan."],
    };
  }

  if (intent === "weekend" || intent === "prep_tomorrow") {
    const items = weekendTitles;
    const lead =
      items.length > 0
        ? intent === "prep_tomorrow"
          ? `Tomorrow, clear Today first (${snapshot.tasks.filter((t) => t.status === "open").length} open). ${items.slice(0, 3).join("; ")}.`
          : `You have ${readiness.percent}% ready and ${snapshot.daysLeft} days left. This weekend: ${items.join("; ")}.`
        : "Nothing is ranked for Today. Add a date, a gift, or a meal if you want more signal.";
    return {
      ...base(),
      message: lead,
      cards: [
        { type: "task_list", title: intent === "prep_tomorrow" ? "Prep next" : "This weekend", items: items.length ? items : ["Open Today for the live checklist"] },
        ...insightCards(insights, ["tasks", "gifts"]),
      ],
      followUpOptions: ["What am I forgetting?", "What gifts am I still missing?"],
    };
  }

  if (intent === "gift_ideas") {
    return {
      ...base(),
      message: "Use Need an idea? on a recipient — Gift Concierge stays in Gifts and can add a result to their list. I don’t invent gifts from private notes.",
      cards: insightCards(insights, ["gifts"]),
      followUpOptions: ["What gifts am I still missing?", "Am I over budget?"],
    };
  }

  if (intent === "coming_next") {
    return {
      ...base(),
      modelPath: "fallback",
      message:
        "Ask about today, gaps, budget, gifts, dinner, travel, grocery, rescue, or what you can ignore. Private notes stay in your planner — Copilot uses Engine facts, not ads.",
      cards: insightCards(insights),
      followUpOptions: ["What should I do this weekend?", "What am I forgetting?", "Am I over budget?"],
      unsupported: { asked: q.slice(0, 80), reason: "ambiguous" },
    };
  }

  return {
    ...base(),
    message: `Your Christmas is ${readiness.percent}% ready.`,
    cards: insightCards(insights),
    followUpOptions: ["What should I do this weekend?", "What am I forgetting?"],
  };
}

export function tryApplyCopilotPlan(
  input?: Parameters<typeof applyCopilotPlan>[0],
): ReturnType<typeof applyCopilotPlan> {
  return applyCopilotPlan(input);
}
