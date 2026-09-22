import type { PlannerIntelligence } from "../intelligence/types";
import { formatPlannerMoney } from "../intelligence/budgetIntelligence";

export type CopilotModule =
  | "home"
  | "today"
  | "plan"
  | "gifts"
  | "meals"
  | "recipes"
  | "grocery"
  | "shopping"
  | "budget"
  | "hosting"
  | "travel"
  | "more"
  | "planner";

export type CopilotSuggestion = {
  id: string;
  label: string;
  prompt: string;
  icon: "gift" | "budget" | "spark" | "meal" | "task" | "cart";
};

export type CopilotNextWin = {
  title: string;
  body: string;
  cta: string;
  prompt: string;
};

function progressedGift(status: string): boolean {
  return ["planned", "ordered", "arrived", "hidden", "wrapped", "given"].includes(status);
}

export function copilotModuleFromPath(pathname: string): CopilotModule {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/account/christmas") return "home";
  if (path.includes("/calendar")) return "today";
  if (path.includes("/plan")) return "plan";
  if (path.includes("/gifts")) return "gifts";
  if (path.includes("/food")) return "meals";
  if (path.includes("/recipes")) return "recipes";
  if (path.includes("/grocery")) return "grocery";
  if (path.includes("/shopping")) return "shopping";
  if (path.includes("/budget")) return "budget";
  if (path.includes("/hosting")) return "hosting";
  if (path.includes("/travel")) return "travel";
  if (path.includes("/more")) return "more";
  return "planner";
}

export function buildCopilotSuggestions(
  module: CopilotModule,
  intel: PlannerIntelligence | null,
): CopilotSuggestion[] {
  if (!intel) {
    return [
      { id: "weekend", label: "What should I do this weekend?", prompt: "What should I do this weekend?", icon: "task" },
      { id: "gifts", label: "What gifts am I still missing?", prompt: "What gifts am I still missing?", icon: "gift" },
      { id: "budget", label: "Am I over budget?", prompt: "Am I over budget?", icon: "budget" },
    ];
  }

  const { snapshot, budget, grocery, todayPriorities } = intel;
  const money = (n: number) => formatPlannerMoney(n, snapshot.currency);
  const done = new Set(snapshot.gifts.filter((g) => progressedGift(g.status)).map((g) => g.recipient_id));
  const missingPeople = snapshot.recipients.filter((r) => !done.has(r.id));
  const firstMissing = missingPeople[0]?.display_name;
  const remaining = Math.max(0, budget.remainingMinor ?? 0);
  const groceryNeed = grocery.filter((g) => g.status === "need").length;
  const topTask = todayPriorities[0]?.title;

  switch (module) {
    case "gifts":
      return [
        firstMissing
          ? {
              id: "gift-person",
              label: `Find a gift for ${firstMissing}`,
              prompt: `Need an idea for ${firstMissing}?`,
              icon: "gift",
            }
          : {
              id: "gift-missing",
              label: "What gifts am I still missing?",
              prompt: "What gifts am I still missing?",
              icon: "gift",
            },
        {
          id: "gift-budget",
          label: remaining > 0 ? `Help me stay under ${money(remaining)}` : "Am I over budget?",
          prompt: remaining > 0 ? `Help me stay under ${money(remaining)}` : "Am I over budget?",
          icon: "budget",
        },
        {
          id: "gift-surprise",
          label: "Surprise me with an idea",
          prompt: firstMissing ? `Surprise me with a gift idea for ${firstMissing}` : "Surprise me with a gift idea",
          icon: "spark",
        },
      ];
    case "budget":
      return [
        {
          id: "budget-check",
          label: remaining > 0 ? `${money(remaining)} left — where to spend?` : "Am I over budget?",
          prompt: "Am I over budget?",
          icon: "budget",
        },
        {
          id: "budget-gifts",
          label: "What gifts am I still missing?",
          prompt: "What gifts am I still missing?",
          icon: "gift",
        },
        {
          id: "budget-weekend",
          label: "What should I do this weekend?",
          prompt: "What should I do this weekend?",
          icon: "task",
        },
      ];
    case "meals":
      return [
        {
          id: "meal-plan",
          label: "Create a dinner plan for 8.",
          prompt: "Create a dinner plan for 8.",
          icon: "meal",
        },
        {
          id: "meal-prep",
          label: "What should I prep tomorrow?",
          prompt: "What should I prep tomorrow?",
          icon: "task",
        },
        {
          id: "meal-rescue",
          label: "Give me a rescue plan.",
          prompt: "Give me a rescue plan.",
          icon: "spark",
        },
      ];
    case "recipes":
    case "grocery":
      return [
        {
          id: "meal-plan",
          label: "Create a dinner plan for 8.",
          prompt: "Create a dinner plan for 8.",
          icon: "meal",
        },
        {
          id: "meal-prep",
          label: "What should I prep tomorrow?",
          prompt: "What should I prep tomorrow?",
          icon: "task",
        },
        groceryNeed > 0
          ? {
              id: "meal-grocery",
              label: `${groceryNeed} grocery items still needed`,
              prompt: "What should I buy for groceries?",
              icon: "cart",
            }
          : {
              id: "meal-rescue",
              label: "Give me a rescue plan.",
              prompt: "Give me a rescue plan.",
              icon: "spark",
            },
      ];
    case "shopping":
      return [
        {
          id: "shop-gifts",
          label: "What gifts am I still missing?",
          prompt: "What gifts am I still missing?",
          icon: "gift",
        },
        groceryNeed > 0
          ? {
              id: "shop-grocery",
              label: `${groceryNeed} ingredients still needed`,
              prompt: "What should I buy for groceries?",
              icon: "cart",
            }
          : {
              id: "shop-budget",
              label: "Am I over budget?",
              prompt: "Am I over budget?",
              icon: "budget",
            },
        {
          id: "shop-weekend",
          label: topTask ? `Focus on: ${topTask}` : "What should I do this weekend?",
          prompt: topTask ? `Help me with: ${topTask}` : "What should I do this weekend?",
          icon: "task",
        },
      ];
    case "today":
    case "plan":
    case "home":
      return [
        {
          id: "plan-weekend",
          label: topTask ? `Next: ${topTask}` : "What should I do this weekend?",
          prompt: "What should I do this weekend?",
          icon: "task",
        },
        {
          id: "plan-gifts",
          label: firstMissing ? `Gift still needed for ${firstMissing}` : "What gifts am I still missing?",
          prompt: firstMissing ? `Need an idea for ${firstMissing}?` : "What gifts am I still missing?",
          icon: "gift",
        },
        {
          id: "plan-rescue",
          label: "Give me a rescue plan.",
          prompt: "Give me a rescue plan.",
          icon: "spark",
        },
      ];
    default:
      return [
        {
          id: "default-weekend",
          label: "What should I do this weekend?",
          prompt: "What should I do this weekend?",
          icon: "task",
        },
        {
          id: "default-gifts",
          label: firstMissing ? `Find a gift for ${firstMissing}` : "What gifts am I still missing?",
          prompt: firstMissing ? `Need an idea for ${firstMissing}?` : "What gifts am I still missing?",
          icon: "gift",
        },
        {
          id: "default-budget",
          label: remaining > 0 ? `Help me stay under ${money(remaining)}` : "Am I over budget?",
          prompt: "Am I over budget?",
          icon: "budget",
        },
      ];
  }
}

export function buildCopilotNextWin(
  module: CopilotModule,
  intel: PlannerIntelligence | null,
): CopilotNextWin {
  if (!intel) {
    return {
      title: "Your next little win",
      body: "Ask anything about your Christmas plan.",
      cta: "Ask Copilot →",
      prompt: "What should I do this weekend?",
    };
  }

  const { snapshot, budget, nextBestAction, todayPriorities } = intel;
  const money = (n: number) => formatPlannerMoney(n, snapshot.currency);
  const done = new Set(snapshot.gifts.filter((g) => progressedGift(g.status)).map((g) => g.recipient_id));
  const missingPeople = snapshot.recipients.filter((r) => !done.has(r.id));
  const firstMissing = missingPeople[0]?.display_name;

  if (module === "gifts" && firstMissing) {
    return {
      title: "Your next little win",
      body: `One thoughtful gift for ${firstMissing}`,
      cta: "Find an idea →",
      prompt: `Need an idea for ${firstMissing}?`,
    };
  }

  if (module === "budget") {
    const remaining = Math.max(0, budget.remainingMinor ?? 0);
    return {
      title: "Your next little win",
      body: remaining > 0 ? `${money(remaining)} left in your Christmas budget` : "Review spending before Christmas",
      cta: "Check budget →",
      prompt: "Am I over budget?",
    };
  }

  if (module === "meals") {
    return {
      title: "Your next little win",
      body: "Build a balanced four-course menu for Christmas Day.",
      cta: "Plan dinner →",
      prompt: "Create a dinner plan for 8.",
    };
  }

  if (module === "recipes" || module === "grocery") {
    return {
      title: "Your next little win",
      body: "Lock a calm Christmas dinner plan",
      cta: "Plan dinner →",
      prompt: "Create a dinner plan for 8.",
    };
  }

  if (module === "shopping") {
    return {
      title: "Your next little win",
      body: firstMissing ? `Shop the remaining gift for ${firstMissing}` : "Clear your shopping list",
      cta: "What to buy →",
      prompt: firstMissing ? `Need an idea for ${firstMissing}?` : "What gifts am I still missing?",
    };
  }

  if (nextBestAction?.title) {
    return {
      title: "Your next little win",
      body: nextBestAction.title,
      cta: "Do this next →",
      prompt: nextBestAction.title,
    };
  }

  if (todayPriorities[0]) {
    return {
      title: "Your next little win",
      body: todayPriorities[0].title,
      cta: "Help me start →",
      prompt: `Help me with: ${todayPriorities[0].title}`,
    };
  }

  return {
    title: "Your next little win",
    body: firstMissing ? `One thoughtful gift for ${firstMissing}` : "Make today count toward Christmas",
    cta: firstMissing ? "Find an idea →" : "What next →",
    prompt: firstMissing ? `Need an idea for ${firstMissing}?` : "What should I do this weekend?",
  };
}
