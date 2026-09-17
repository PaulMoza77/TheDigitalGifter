/**
 * Constrained Christmas assistant foundation.
 * V1 does not send private planner text to a model.
 * Answers are generated from structured counts only.
 */

export type AssistantSafeContext = {
  daysLeft: number;
  planMode: string;
  readinessPercent: number;
  openTasks: number;
  recipientCount: number;
  giftsWithoutPlan: number;
  budgetRemainingMinor: number | null;
  currency: string;
  hosting: boolean;
};

export type AssistantReply = {
  source: "local_rules" | "coming_next";
  text: string;
};

const SAFE_INTENTS = [
  "weekend",
  "budget",
  "forgetting",
  "dinner",
  "gift_ideas",
  "rescue",
] as const;

export function classifyAssistantIntent(question: string): (typeof SAFE_INTENTS)[number] | "coming_next" {
  const q = question.toLowerCase();
  if (q.includes("weekend") || q.includes("today") || q.includes("should i do")) return "weekend";
  if (q.includes("budget") || q.includes("stay within")) return "budget";
  if (q.includes("forgetting") || q.includes("forget")) return "forgetting";
  if (q.includes("dinner") || q.includes("menu")) return "dinner";
  if (q.includes("gift") && (q.includes("idea") || q.includes("dad") || q.includes("under"))) return "gift_ideas";
  if (q.includes("rescue") || q.includes("7-day") || q.includes("7 day")) return "rescue";
  return "coming_next";
}

export function answerFromContext(question: string, ctx: AssistantSafeContext): AssistantReply {
  const intent = classifyAssistantIntent(question);
  if (intent === "weekend") {
    return {
      source: "local_rules",
      text:
        ctx.openTasks > 0
          ? `You have ${ctx.openTasks} open tasks and ${ctx.daysLeft} days left. Finish the top three on Today first — that’s the fastest readiness gain.`
          : `You’re caught up on tasks. Add one gift idea or a meal if you’re hosting.`,
    };
  }
  if (intent === "budget") {
    if (ctx.budgetRemainingMinor == null) {
      return { source: "local_rules", text: "Set a season budget in Budget, then I can tell you if you’re on track — without storing extra notes." };
    }
    const remaining = (ctx.budgetRemainingMinor / 100).toFixed(0);
    return {
      source: "local_rules",
      text: `About ${remaining} ${ctx.currency.toUpperCase()} remains versus your plan. Close unordered gifts before adding new categories.`,
    };
  }
  if (intent === "forgetting") {
    const bits = [];
    if (ctx.giftsWithoutPlan > 0) bits.push(`${ctx.giftsWithoutPlan} people still need a planned gift`);
    if (ctx.hosting) bits.push("hosting menus and dietary notes");
    if (ctx.openTasks > 3) bits.push("overdue tasks on Today");
    return {
      source: "local_rules",
      text: bits.length ? `Likely gaps: ${bits.join("; ")}.` : "No obvious gaps from your structured plan.",
    };
  }
  if (intent === "dinner") {
    return {
      source: "local_rules",
      text: ctx.hosting
        ? "Open Food, add Christmas Day, then save a recipe so groceries roll up. Full AI menus are coming next — with server-side privacy controls."
        : "You’re not marked as hosting. Turn hosting on in Settings if you need a dinner plan.",
    };
  }
  if (intent === "gift_ideas") {
    return {
      source: "local_rules",
      text: "Use Need an idea? on a recipient — that opens Gift Finder and can add a result back. I don’t invent gifts from private notes.",
    };
  }
  if (intent === "rescue") {
    return {
      source: "local_rules",
      text: `Rescue mode is ${ctx.planMode === "rescue" ? "already on" : "used automatically when fewer than 8 days remain"}. Do gifts that must ship, then food shop, then wrap.`,
    };
  }
  return {
    source: "coming_next",
    text: "Ask Christmas AI can answer from your planner counts. Private notes stay on the server until a controlled assistant ships.",
  };
}
