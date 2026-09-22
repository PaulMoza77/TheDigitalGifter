import { formatPlannerMoney } from "../intelligence/budgetIntelligence";
import type { PlannerIntelligence } from "../intelligence/types";

/** Cozy fireplace still — no UI chrome, no portraits, no product buttons. */
export const COPILOT_PANEL_PHOTO = "/assets/christmas/christmas_hero_room.webp";

export type CopilotSuggestionIcon = "gift" | "budget" | "idea" | "task" | "food" | "shop";

export type CopilotSuggestion = {
  id: string;
  label: string;
  prompt: string;
  icon: CopilotSuggestionIcon;
};

export type CopilotNextWin = {
  kicker: string;
  title: string;
  cta: string;
  prompt: string;
  href?: string;
};

function progressedGift(status: string): boolean {
  return ["planned", "ordered", "arrived", "hidden", "wrapped", "given"].includes(status);
}

function missingRecipients(intel: PlannerIntelligence) {
  const done = new Set(intel.snapshot.gifts.filter((g) => progressedGift(g.status)).map((g) => g.recipient_id));
  return intel.snapshot.recipients.filter((r) => !done.has(r.id));
}

function money(intel: PlannerIntelligence, minor: number) {
  return formatPlannerMoney(minor, intel.snapshot.currency);
}

export function copilotModuleFromPath(pathname: string): string {
  if (pathname.includes("/gifts")) return "gifts";
  if (pathname.includes("/budget")) return "budget";
  if (pathname.includes("/food") || pathname.includes("/recipes")) return "food";
  if (pathname.includes("/shopping") || pathname.includes("/grocery")) return "shopping";
  if (pathname.includes("/plan") || pathname.includes("/calendar")) return "plan";
  return "today";
}

export function copilotSuggestions(pathname: string, intel: PlannerIntelligence | null): CopilotSuggestion[] {
  const module = copilotModuleFromPath(pathname);
  if (!intel) {
    return [
      { id: "weekend", label: "What should I do this weekend?", prompt: "What should I do this weekend?", icon: "task" },
      { id: "gifts", label: "What gifts am I still missing?", prompt: "What gifts am I still missing?", icon: "gift" },
      { id: "budget", label: "Am I over budget?", prompt: "Am I over budget?", icon: "budget" },
    ];
  }

  const missing = missingRecipients(intel);
  const remaining = intel.budget.remainingAfterSpendMinor ?? intel.budget.remainingMinor;
  const groceryNeed = intel.grocery.filter((g) => g.status === "need").length;
  const openTasks = intel.snapshot.tasks.filter((t) => t.status === "open" || t.status === "rescheduled").length;
  const firstMissing = missing[0]?.display_name;

  if (module === "gifts") {
    return [
      firstMissing
        ? { id: "find-gift", label: `Find a gift for ${firstMissing}`, prompt: `What gifts am I still missing?`, icon: "gift" }
        : { id: "find-gift", label: "What gifts am I still missing?", prompt: "What gifts am I still missing?", icon: "gift" },
      remaining != null
        ? { id: "stay-under", label: `Help me stay under ${money(intel, remaining)}`, prompt: "Am I over budget?", icon: "budget" }
        : { id: "stay-under", label: "Am I over budget?", prompt: "Am I over budget?", icon: "budget" },
      { id: "surprise", label: "Surprise me with an idea", prompt: "Need an idea for someone on my list?", icon: "idea" },
    ];
  }

  if (module === "budget") {
    return [
      remaining != null
        ? { id: "left", label: `How much is left (${money(intel, remaining)})?`, prompt: "Am I over budget?", icon: "budget" }
        : { id: "left", label: "Am I over budget?", prompt: "Am I over budget?", icon: "budget" },
      { id: "skip", label: "What can I safely ignore?", prompt: "What can I safely ignore?", icon: "task" },
      firstMissing
        ? { id: "gift-cost", label: `Still shopping for ${firstMissing}`, prompt: "What gifts am I still missing?", icon: "gift" }
        : { id: "gift-cost", label: "What gifts am I still missing?", prompt: "What gifts am I still missing?", icon: "gift" },
    ];
  }

  if (module === "food") {
    const meals = intel.snapshot.meals.length;
    return [
      meals
        ? { id: "menu", label: `Check my ${meals} ${meals === 1 ? "menu" : "menus"}`, prompt: "Create a dinner plan for 8.", icon: "food" }
        : { id: "menu", label: "Create a dinner plan", prompt: "Create a dinner plan for 8.", icon: "food" },
      groceryNeed
        ? { id: "grocery", label: `${groceryNeed} grocery ${groceryNeed === 1 ? "item" : "items"} still needed`, prompt: "Give me a grocery list.", icon: "shop" }
        : { id: "grocery", label: "Give me a grocery list", prompt: "Give me a grocery list.", icon: "shop" },
      { id: "prep", label: "What should I prep tomorrow?", prompt: "What should I prep tomorrow?", icon: "task" },
    ];
  }

  if (module === "shopping") {
    return [
      groceryNeed
        ? { id: "need", label: `${groceryNeed} items still to pick up`, prompt: "Give me a grocery list.", icon: "shop" }
        : { id: "need", label: "What’s left on my lists?", prompt: "Give me a grocery list.", icon: "shop" },
      firstMissing
        ? { id: "gift-shop", label: `Shop for ${firstMissing}`, prompt: "What gifts am I still missing?", icon: "gift" }
        : { id: "gift-shop", label: "What gifts am I still missing?", prompt: "What gifts am I still missing?", icon: "gift" },
      { id: "budget-shop", label: "Am I over budget?", prompt: "Am I over budget?", icon: "budget" },
    ];
  }

  return [
    openTasks
      ? { id: "weekend", label: `${openTasks} open ${openTasks === 1 ? "task" : "tasks"} this season`, prompt: "What should I do this weekend?", icon: "task" }
      : { id: "weekend", label: "What should I do this weekend?", prompt: "What should I do this weekend?", icon: "task" },
    firstMissing
      ? { id: "gifts", label: `Find a gift for ${firstMissing}`, prompt: "What gifts am I still missing?", icon: "gift" }
      : { id: "gifts", label: "What gifts am I still missing?", prompt: "What gifts am I still missing?", icon: "gift" },
    { id: "next", label: "What am I forgetting?", prompt: "What am I forgetting?", icon: "idea" },
  ];
}

export function copilotNextWin(pathname: string, intel: PlannerIntelligence | null): CopilotNextWin {
  const module = copilotModuleFromPath(pathname);
  if (intel?.nextBestAction) {
    const nba = intel.nextBestAction;
    const prompt =
      nba.category === "gifts"
        ? "What gifts am I still missing?"
        : nba.category === "budget"
          ? "Am I over budget?"
          : nba.category === "food" || nba.category === "hosting"
            ? "Create a dinner plan for 8."
            : nba.category === "shopping"
              ? "Give me a grocery list."
              : "What should I do this weekend?";
    return {
      kicker: "Your next little win",
      title: nba.title,
      cta: module === "gifts" ? "Find an idea" : "Ask Copilot",
      prompt,
      href: nba.href,
    };
  }

  const missing = intel ? missingRecipients(intel)[0] : null;
  if (module === "gifts" && missing) {
    return {
      kicker: "Your next little win",
      title: `One thoughtful gift for ${missing.display_name}.`,
      cta: "Find an idea",
      prompt: "What gifts am I still missing?",
      href: "/account/christmas/gifts",
    };
  }

  return {
    kicker: "Your next little win",
    title: intel ? `You’re ${intel.readiness.percent}% ready. Ask what to do next.` : "Ask Christmas Copilot about your plan.",
    cta: "Ask Copilot",
    prompt: "What should I do this weekend?",
  };
}
