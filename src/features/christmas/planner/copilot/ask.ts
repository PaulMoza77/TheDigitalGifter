import { classifyAssistantIntent } from "../assistant";
import type { IntelligenceBundle, PlannerInsight } from "../intelligence";
import { applyCopilotPlan, type ApplyPlanResult } from "./registry";

function money(minor: number, currency: string): string {
  const n = Number(minor || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "eur").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toFixed(0)} ${(currency || "eur").toUpperCase()}`;
  }
}

export type CopilotCard =
  | { type: "insight"; title: string; body: string; href?: string }
  | { type: "task_list"; title: string; items: string[] }
  | { type: "budget_summary"; planned: string; spent: string; remaining: string }
  | { type: "meal_plan"; title: string; body: string };

export type CopilotFollowUp = string;

export type CopilotResponse = {
  message: string;
  tone: "steady" | "rescue" | "celebrate";
  insightsUsed: Array<{ id: string; kind: string; module: string }>;
  nextBestActions: Array<{ id: string; label: string; href?: string }>;
  suggestedActions: never[];
  actionPlan: null;
  requiresConfirmation: boolean;
  followUpOptions: CopilotFollowUp[];
  cards: CopilotCard[];
  modelPath: "deterministic" | "fallback";
  snapshotVersion: string;
  unsupported?: { asked: string; reason: "no_tool" | "forbidden" | "ambiguous" };
};

const WRITE_HINT =
  "I can show the plan. I won’t create, move, or delete anything until you confirm in a later Copilot release.";

function insightCards(insights: PlannerInsight[], kinds?: PlannerInsight["kind"][]): CopilotCard[] {
  const picked = kinds ? insights.filter((i) => kinds.includes(i.kind)) : insights.slice(0, 3);
  return picked.slice(0, 3).map((i) => ({
    type: "insight" as const,
    title: i.title,
    body: i.fact,
    href: i.href,
  }));
}

function used(insights: PlannerInsight[]): CopilotResponse["insightsUsed"] {
  return insights.slice(0, 4).map((i) => ({ id: i.id, kind: i.kind, module: i.module }));
}

export function copilotEnabled(): boolean {
  const raw = String(import.meta.env.VITE_CHRISTMAS_PLANNER_COPILOT ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

/** LLM path is compiled out of P0 production. Flip later with a server kill switch. */
export function copilotLlmEnabled(): boolean {
  return false;
}

export function askCopilot(question: string, bundle: IntelligenceBundle): CopilotResponse {
  const q = question.trim().slice(0, 240);
  const { snapshot, insights, nextBestActions } = bundle;
  const intent = classifyAssistantIntent(q);
  const lower = q.toLowerCase();
  const nbas = nextBestActions.map((a) => ({ id: a.id, label: a.label, href: a.href }));
  const moneyCur = (n: number) => money(n, snapshot.currency);
  const tone = snapshot.planMode === "rescue" ? "rescue" : snapshot.readinessPercent >= 80 ? "celebrate" : "steady";

  const base = (): Omit<CopilotResponse, "message" | "cards" | "followUpOptions" | "unsupported"> => ({
    tone,
    insightsUsed: used(insights),
    nextBestActions: nbas,
    suggestedActions: [],
    actionPlan: null,
    requiresConfirmation: false,
    modelPath: "deterministic",
    snapshotVersion: snapshot.version,
  });

  if (
    lower.includes("ignore") ||
    lower.includes("skip") ||
    lower.includes("safely ignore") ||
    lower.includes("don't bother")
  ) {
    const items = snapshot.skippableTaskTitles;
    return {
      ...base(),
      message: items.length
        ? `You can safely leave these for later: ${items.join("; ")}. Don’t skip shipping gifts, travel start, or dinner if you’re hosting.`
        : "Nothing looks skippable from the structured plan. Low-priority tasks more than 10 days out will show up here.",
      cards: [
        { type: "task_list", title: "Safe to ignore", items: items.length ? items : ["No low-priority far-dated tasks"] },
        ...insightCards(insights, ["low_priority_skip", "rescue_mode"]),
      ],
      followUpOptions: ["What should I do this weekend?", "Give me a rescue plan."],
    };
  }

  if (lower.includes("grocery") || lower.includes("shopping list") || (lower.includes("list") && lower.includes("food"))) {
    return {
      ...base(),
      message: snapshot.hosting
        ? snapshot.mealsCount
          ? `You have ${snapshot.mealsCount} ${snapshot.mealsCount === 1 ? "meal" : "meals"} on the plan and ${snapshot.groceryNeedCount} grocery ${snapshot.groceryNeedCount === 1 ? "item" : "items"} still marked need. Open Grocery to tick them off — I won’t invent ingredients from private notes.`
          : "Add Christmas Eve or Day in Food first, then I can turn dishes into a grocery list (without writing it for you yet)."
        : "You’re not marked as hosting. Turn hosting on in Settings if you need a dinner grocery list.",
      cards: insightCards(insights, ["no_menu"]),
      followUpOptions: ["Create a dinner plan for 8.", "What am I forgetting?"],
      unsupported: { asked: "add_grocery_item", reason: "no_tool" },
    };
  }

  if (
    lower.includes("travel") ||
    lower.includes("leaving") ||
    lower.includes("trip") ||
    /\bdec(ember)?\s*22\b/.test(lower)
  ) {
    const trip = snapshot.tripStartOn;
    return {
      ...base(),
      message: trip
        ? `Your plan has travel starting ${trip}. ${insights.find((i) => i.kind === "trip_deadline")?.fact || ""} I can list the squeeze — I will not move dates until you confirm in a later release.`
        : "No trip is saved yet. Add one in Travel (dates only — no passport or booking secrets). Then I can list what should finish before you leave.",
      cards: insightCards(insights, ["trip_deadline", "overdue_tasks"]),
      followUpOptions: ["Move my important tasks earlier.", "What should I do this weekend?"],
      unsupported: trip ? { asked: "reschedule_task", reason: "no_tool" } : undefined,
    };
  }

  if (lower.includes("move") && (lower.includes("earlier") || lower.includes("before") || lower.includes("task"))) {
    return {
      ...base(),
      message: `${WRITE_HINT} Open Plan to drag dates, or wait for confirmed bulk reschedule.`,
      cards: insightCards(insights, ["trip_deadline", "overdue_tasks"]),
      followUpOptions: ["I’m travelling on Dec 22.", "What should I do this weekend?"],
      unsupported: { asked: "reschedule_task", reason: "no_tool" },
    };
  }

  if (lower.includes("behind") || lower.includes("completely") || intent === "rescue") {
    const focus = [...snapshot.overdueTaskTitles, ...snapshot.weekendTaskTitles].slice(0, 3);
    return {
      ...base(),
      tone: "rescue",
      message: snapshot.planMode === "rescue"
        ? `Rescue is on (${snapshot.daysLeft} days). Do gifts that must ship, then food shop, then wrap.${focus.length ? ` Start with: ${focus.join("; ")}.` : ""}`
        : `You’re ${snapshot.readinessPercent}% ready with ${snapshot.openTasks} open tasks. Treat it as rescue: three things only — gifts that must ship, food shop, wrap.`,
      cards: [
        { type: "task_list", title: "Rescue focus", items: focus.length ? focus : ["Pick three things that still matter"] },
        ...insightCards(insights, ["rescue_mode", "missing_gifts", "no_menu"]),
      ],
      followUpOptions: ["What gifts am I still missing?", "What can I safely ignore?"],
    };
  }

  if (intent === "missing_gifts" || (lower.includes("dad") && lower.includes("gift")) || lower.includes("who still")) {
    const names = snapshot.missingGiftNames;
    const dad = names.find((n) => /dad|father|papa|tata/i.test(n));
    const askedDad = lower.includes("dad") || lower.includes("father");
    const message = askedDad
      ? dad
        ? `${dad} is on the list without a planned gift. Open Gifts and use Need an idea? — I don’t invent gifts from private notes.`
        : names.length
          ? `I don’t see a “Dad” label. Still missing a planned gift: ${names.join(", ")}.`
          : "Every person on your gift list has at least one planned gift."
      : names.length
        ? `${names.length} ${names.length === 1 ? "person still needs" : "people still need"} a planned gift${names.length ? `: ${names.join(", ")}` : ""}.`
        : "Every person on your gift list has at least one planned gift.";
    return {
      ...base(),
      message,
      cards: insightCards(insights, ["missing_gifts"]),
      followUpOptions: ["What should I do this weekend?", "Am I over budget?"],
    };
  }

  if (intent === "budget" || lower.includes("€") || lower.includes("left") && lower.includes("500")) {
    if (snapshot.budgetRemainingMinor == null) {
      return {
        ...base(),
        message: "Set a season budget in Budget, then I can tell you if you’re on track — without sending amounts to ads.",
        cards: insightCards(insights, ["budget_unset"]),
        followUpOptions: ["What am I forgetting?", "What gifts am I still missing?"],
      };
    }
    const tight = insights.find((i) => i.kind === "budget_over" || i.kind === "budget_tight");
    return {
      ...base(),
      message: tight
        ? `${tight.fact} Close unordered gifts before adding new categories.`
        : `About ${moneyCur(snapshot.budgetRemainingMinor)} remains versus your plan. Spent ${moneyCur(snapshot.budgetSpentMinor)} of ${moneyCur(snapshot.budgetPlannedMinor)}.`,
      cards: [
        {
          type: "budget_summary",
          planned: moneyCur(snapshot.budgetPlannedMinor),
          spent: moneyCur(snapshot.budgetSpentMinor),
          remaining: moneyCur(snapshot.budgetRemainingMinor),
        },
        ...insightCards(insights, ["budget_over", "budget_tight", "budget_unset"]),
      ],
      followUpOptions: ["What gifts am I still missing?", "What can I safely ignore?"],
    };
  }

  if (intent === "dinner" || lower.includes("people") && lower.includes("dinner") || lower.includes("for 10") || lower.includes("for 8")) {
    const head = lower.match(/for\s+(\d+)/)?.[1];
    return {
      ...base(),
      message: snapshot.hosting
        ? `You’re hosting. ${head ? `For ${head} people: ` : ""}set servings on Christmas Day in Food, add dishes, then send ingredients to Grocery. ${WRITE_HINT}`
        : "You’re not marked as hosting. Turn hosting on in Settings if you need a dinner plan.",
      cards: [
        {
          type: "meal_plan",
          title: "Christmas dinner",
          body: snapshot.mealsCount
            ? `${snapshot.mealsCount} meals already on the plan.`
            : "Eve + Day menus are the fastest hosting win.",
        },
        ...insightCards(insights, ["no_menu"]),
      ],
      followUpOptions: ["Give me a grocery list.", "What am I forgetting?"],
      unsupported: { asked: "add_meal", reason: "no_tool" },
    };
  }

  if (intent === "forgetting") {
    const bits = insights.filter((i) => i.kind !== "caught_up" && i.kind !== "weekend_focus").map((i) => i.fact);
    return {
      ...base(),
      message: bits.length ? `Likely gaps: ${bits.slice(0, 4).join(" ")}` : "No obvious gaps from your structured plan.",
      cards: insightCards(insights),
      followUpOptions: ["What should I do this weekend?", "Give me a rescue plan."],
    };
  }

  if (intent === "weekend" || intent === "prep_tomorrow") {
    const items = intent === "prep_tomorrow" ? snapshot.weekendTaskTitles : snapshot.weekendTaskTitles;
    const lead =
      items.length > 0
        ? intent === "prep_tomorrow"
          ? `Tomorrow, clear the top of Today first (${snapshot.openTasks} open). ${items.slice(0, 3).join("; ")}.`
          : `You have ${snapshot.openTasks} open tasks and ${snapshot.daysLeft} days left. This weekend: ${items.join("; ")}.`
        : snapshot.openTasks > 0
          ? `You have ${snapshot.openTasks} open tasks and ${snapshot.daysLeft} days left. Finish the top three on Today first.`
          : "You’re caught up on tasks. Add one gift idea or a meal if you’re hosting.";
    return {
      ...base(),
      message: lead,
      cards: [
        { type: "task_list", title: intent === "prep_tomorrow" ? "Prep next" : "This weekend", items: items.length ? items : ["Open Today for the live checklist"] },
        ...insightCards(insights, ["overdue_tasks", "weekend_focus", "missing_gifts"]),
      ],
      followUpOptions: ["What am I forgetting?", "What gifts am I still missing?"],
    };
  }

  if (intent === "gift_ideas") {
    return {
      ...base(),
      message: "Use Need an idea? on a recipient — that opens Gift Finder and can add a result back. I don’t invent gifts from private notes.",
      cards: insightCards(insights, ["missing_gifts"]),
      followUpOptions: ["What gifts am I still missing?", "Am I over budget?"],
    };
  }

  if (intent === "coming_next") {
    return {
      ...base(),
      modelPath: "fallback",
      message:
        "Ask about today, gaps, budget, gifts, dinner, travel, grocery, rescue, or what you can ignore. Private notes stay in your planner — Copilot uses counts, dates, and names already on your lists.",
      cards: insightCards(insights),
      followUpOptions: ["What should I do this weekend?", "What am I forgetting?", "Am I over budget?"],
      unsupported: { asked: q.slice(0, 80), reason: "ambiguous" },
    };
  }

  return {
    ...base(),
    message: `Your Christmas is ${snapshot.readinessPercent}% ready with ${snapshot.openTasks} open tasks.`,
    cards: insightCards(insights),
    followUpOptions: ["What should I do this weekend?", "What am I forgetting?"],
  };
}

export function tryApplyCopilotPlan(): ApplyPlanResult {
  return applyCopilotPlan();
}
