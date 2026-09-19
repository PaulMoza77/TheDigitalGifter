import { addDays, isoDate, type LocalDateParts } from "./date";
import type { PlanMode, PreparedLevel, TaskCategory } from "./types";

export type PlanTemplateTask = {
  template_key: string;
  title: string;
  category: TaskCategory;
  offsetDays: number;
  priority: "low" | "normal" | "high";
  when: Array<PlanMode | "always">;
  ifHosting?: boolean;
  ifTravel?: boolean;
  ifChildren?: boolean;
  minGifts?: number;
};

const TEMPLATES: PlanTemplateTask[] = [
  {
    template_key: "set_budget",
    title: "Set your total Christmas budget",
    category: "gifts",
    offsetDays: 90,
    priority: "high",
    when: ["early", "standard", "sprint", "rescue", "always"],
  },
  {
    template_key: "list_recipients",
    title: "List everyone you’re gifting",
    category: "gifts",
    offsetDays: 85,
    priority: "high",
    when: ["early", "standard", "sprint", "rescue", "always"],
  },
  {
    template_key: "gift_ideas",
    title: "Capture at least one idea per person",
    category: "gifts",
    offsetDays: 70,
    priority: "high",
    when: ["early", "standard", "sprint", "always"],
    minGifts: 1,
  },
  {
    template_key: "order_shipped_gifts",
    title: "Order gifts that need shipping",
    category: "shopping",
    offsetDays: 28,
    priority: "high",
    when: ["early", "standard", "sprint", "rescue", "always"],
  },
  {
    template_key: "wrap_gifts",
    title: "Wrap remaining gifts",
    category: "gifts",
    offsetDays: 3,
    priority: "normal",
    when: ["standard", "sprint", "rescue", "always"],
  },
  {
    template_key: "card_list",
    title: "Decide who needs a card or message",
    category: "cards",
    offsetDays: 40,
    priority: "normal",
    when: ["early", "standard", "sprint", "always"],
  },
  {
    template_key: "send_cards",
    title: "Send cards (or digital messages)",
    category: "cards",
    offsetDays: 12,
    priority: "high",
    when: ["standard", "sprint", "rescue", "always"],
  },
  {
    template_key: "menu_draft",
    title: "Draft Christmas Eve & Day menus",
    category: "food",
    offsetDays: 21,
    priority: "high",
    when: ["early", "standard", "sprint", "rescue"],
    ifHosting: true,
  },
  {
    template_key: "grocery_shop",
    title: "Do the main grocery shop",
    category: "food",
    offsetDays: 3,
    priority: "high",
    when: ["standard", "sprint", "rescue"],
    ifHosting: true,
  },
  {
    template_key: "guest_rsvp",
    title: "Confirm guest list and dietary needs",
    category: "hosting",
    offsetDays: 18,
    priority: "high",
    when: ["early", "standard", "sprint", "rescue"],
    ifHosting: true,
  },
  {
    template_key: "sleeping",
    title: "Plan sleeping arrangements",
    category: "hosting",
    offsetDays: 10,
    priority: "normal",
    when: ["standard", "sprint", "rescue"],
    ifHosting: true,
  },
  {
    template_key: "start_buying",
    title: "Start buying gifts that need shipping",
    category: "shopping",
    offsetDays: 60,
    priority: "high",
    when: ["early", "standard"],
    minGifts: 1,
  },
  {
    template_key: "plan_decor",
    title: "Plan tree, lights, and table decor",
    category: "decorating",
    offsetDays: 50,
    priority: "normal",
    when: ["early", "standard"],
  },
  {
    template_key: "book_activities",
    title: "Book markets, photos, or family activities",
    category: "events",
    offsetDays: 45,
    priority: "normal",
    when: ["early", "standard"],
  },
  {
    template_key: "order_remaining",
    title: "Order remaining gifts",
    category: "shopping",
    offsetDays: 21,
    priority: "high",
    when: ["early", "standard", "sprint", "rescue", "always"],
  },
  {
    template_key: "prepare_house",
    title: "Prepare the house for guests or Christmas Day",
    category: "home",
    offsetDays: 5,
    priority: "normal",
    when: ["standard", "sprint", "rescue"],
    ifHosting: true,
  },
  {
    template_key: "tree_up",
    title: "Put up the tree and lights",
    category: "decorating",
    offsetDays: 30,
    priority: "normal",
    when: ["early", "standard", "sprint"],
  },
  {
    template_key: "travel_book",
    title: "Confirm travel bookings and times",
    category: "travel",
    offsetDays: 21,
    priority: "high",
    when: ["early", "standard", "sprint", "rescue"],
    ifTravel: true,
  },
  {
    template_key: "pack_bags",
    title: "Pack bags and gifts to take",
    category: "travel",
    offsetDays: 2,
    priority: "high",
    when: ["sprint", "rescue"],
    ifTravel: true,
  },
  {
    template_key: "kids_photos",
    title: "Schedule family / kids photos",
    category: "family",
    offsetDays: 25,
    priority: "normal",
    when: ["early", "standard", "sprint"],
    ifChildren: true,
  },
  {
    template_key: "kids_eve",
    title: "Prep Christmas Eve for children",
    category: "family",
    offsetDays: 1,
    priority: "high",
    when: ["sprint", "rescue", "always"],
    ifChildren: true,
  },
  {
    template_key: "lights_walk",
    title: "Plan a lights walk or movie night",
    category: "events",
    offsetDays: 14,
    priority: "low",
    when: ["early", "standard", "sprint"],
  },
  {
    template_key: "personal_rest",
    title: "Block one quiet hour for yourself",
    category: "personal",
    offsetDays: 4,
    priority: "low",
    when: ["sprint", "rescue", "always"],
  },
  {
    template_key: "rescue_today",
    title: "Pick the three things that still matter",
    category: "personal",
    offsetDays: 0,
    priority: "high",
    when: ["rescue"],
  },
  {
    template_key: "wrap_memories",
    title: "Write one note for next year’s planner",
    category: "personal",
    offsetDays: -1,
    priority: "normal",
    when: ["wrap"],
  },
];

export type GeneratePlanInput = {
  today: LocalDateParts;
  christmas: LocalDateParts;
  mode: PlanMode;
  hosting: boolean;
  travelling: boolean;
  hasChildren: boolean;
  giftCount: number;
  prepared: PreparedLevel;
  chaos?: string[];
};

export type GeneratedTask = {
  title: string;
  category: TaskCategory;
  due_on: string;
  status: "open";
  priority: "low" | "normal" | "high";
  notes: string;
  origin: "system";
  template_key: string;
};

function clampDue(christmas: LocalDateParts, offsetFromChristmas: number, today: LocalDateParts): LocalDateParts {
  const due = addDays(christmas, -Math.max(offsetFromChristmas, 0));
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const dueUtc = Date.UTC(due.year, due.month - 1, due.day);
  if (dueUtc < todayUtc) return today;
  return due;
}

const CHAOS_BOOST: Record<string, TaskCategory[]> = {
  gifts: ["gifts", "shopping"],
  budget: ["gifts", "shopping"],
  food: ["food"],
  hosting: ["hosting", "decorating", "home"],
  family: ["family", "events", "cards"],
};

export function generateInitialPlan(input: GeneratePlanInput): GeneratedTask[] {
  const daysLeft = Math.round(
    (Date.UTC(input.christmas.year, 11, 25) - Date.UTC(input.today.year, input.today.month - 1, input.today.day)) /
      86_400_000,
  );
  const chaos = input.chaos || [];
  const everything = chaos.includes("everything");

  return TEMPLATES.filter((tpl) => {
    if (!tpl.when.includes("always") && !tpl.when.includes(input.mode)) return false;
    if (tpl.ifHosting && !input.hosting) return false;
    if (tpl.ifTravel && !input.travelling) return false;
    if (tpl.ifChildren && !input.hasChildren) return false;
    if (tpl.minGifts && input.giftCount < tpl.minGifts) return false;
    if (input.mode === "wrap" && tpl.when.includes("wrap")) return true;
    if (input.mode === "wrap") return tpl.template_key === "wrap_memories";
    return true;
  }).map((tpl) => {
    const offset = input.mode === "rescue" ? Math.min(tpl.offsetDays, Math.max(daysLeft, 0)) : tpl.offsetDays;
    const due = tpl.offsetDays < 0 ? addDays(input.christmas, 1) : clampDue(input.christmas, offset, input.today);
    const boosted =
      everything ||
      chaos.some((id) => (CHAOS_BOOST[id] || []).includes(tpl.category) || (id === "budget" && tpl.template_key === "set_budget"));
    return {
      title: tpl.title,
      category: tpl.category,
      due_on: isoDate(due),
      status: "open" as const,
      priority: boosted && tpl.priority === "low" ? ("normal" as const) : tpl.priority,
      notes: "",
      origin: "system" as const,
      template_key: tpl.template_key,
    };
  });
}

/** Keep the generated plan useful — do not dump every seasonal task at once. */
export function progressiveSurface(tasks: GeneratedTask[], todayIso: string, mode: PlanMode): GeneratedTask[] {
  const windowDays = mode === "rescue" ? 8 : mode === "sprint" ? 16 : mode === "standard" ? 32 : 50;
  const cap = mode === "rescue" ? 7 : mode === "sprint" ? 10 : mode === "wrap" ? 4 : 14;
  const ranked = [...tasks].sort((a, b) => {
    const pri = (t: GeneratedTask) => (t.priority === "high" ? 0 : t.priority === "normal" ? 1 : 2);
    if (pri(a) !== pri(b)) return pri(a) - pri(b);
    return a.due_on.localeCompare(b.due_on);
  });
  const picked: GeneratedTask[] = [];
  for (const task of ranked) {
    const due = task.due_on || todayIso;
    const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86_400_000);
    const essential = task.priority === "high" || days <= windowDays;
    if (!essential && picked.length >= Math.min(6, cap)) continue;
    picked.push(task);
    if (picked.length >= cap) break;
  }
  return picked;
}

export function recommendedToday<T extends { due_on: string | null; status: string; priority: string }>(
  tasks: T[],
  todayIso: string,
  limit = 3,
): T[] {
  const open = tasks.filter((t) => t.status === "open");
  const rank = (t: T) => {
    const due = t.due_on || "9999-12-31";
    const overdue = due < todayIso ? 0 : 1;
    const pri = t.priority === "high" ? 0 : t.priority === "normal" ? 1 : 2;
    return [overdue, due, pri] as const;
  };
  return [...open].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra[0] !== rb[0]) return ra[0] - rb[0];
    if (ra[1] !== rb[1]) return ra[1] < rb[1] ? -1 : 1;
    return ra[2] - rb[2];
  }).slice(0, limit);
}
