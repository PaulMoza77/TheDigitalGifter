import { isToBuy } from "./gifts/giftProgress";
import type { GiftItem, PlannerTask, TaskCategory } from "./types";

export type StarterTaskIcon = "budget" | "gift" | "travel" | "home";

export type StarterTask = {
  key: string;
  title: string;
  description: string;
  category: TaskCategory;
  icon: StarterTaskIcon;
  aliases: string[];
  priority: PlannerTask["priority"];
};

export const STARTER_TASKS: readonly StarterTask[] = [
  {
    key: "set_budget",
    title: "Set your Christmas budget",
    description: "Know what you want to spend and stick to it.",
    category: "gifts",
    icon: "budget",
    aliases: ["Set your total Christmas budget"],
    priority: "high",
  },
  {
    key: "start_gift_list",
    title: "Start your gift list",
    description: "Add family, friends and gift ideas.",
    category: "gifts",
    icon: "gift",
    aliases: ["List everyone you’re gifting", "List everyone you're gifting"],
    priority: "high",
  },
  {
    key: "decide_christmas_place",
    title: "Decide where you’re spending Christmas",
    description: "Home, traveling, or hosting?",
    category: "travel",
    icon: "travel",
    aliases: ["Decide where you're spending Christmas"],
    priority: "high",
  },
  {
    key: "plan_decor",
    title: "Plan your decorations",
    description: "Make your home feel magical.",
    category: "decorating",
    icon: "home",
    aliases: ["Plan tree, lights, and table decor"],
    priority: "normal",
  },
];

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/['’]/g, "'");
}

export function taskMatchesStarter(task: Pick<PlannerTask, "title" | "template_key">, starter: StarterTask): boolean {
  if (task.template_key === starter.key) return true;
  if (starter.key === "start_gift_list" && task.template_key === "list_recipients") return true;
  const title = normalizeTitle(task.title);
  if (title === normalizeTitle(starter.title)) return true;
  return starter.aliases.some((alias) => normalizeTitle(alias) === title);
}

export function missingStarterTasks(tasks: Array<Pick<PlannerTask, "title" | "template_key">>): StarterTask[] {
  return STARTER_TASKS.filter((starter) => !tasks.some((task) => taskMatchesStarter(task, starter)));
}

export function findStarterMatch<T extends Pick<PlannerTask, "title" | "template_key">>(
  tasks: T[],
  starter: StarterTask,
): T | undefined {
  return tasks.find((task) => taskMatchesStarter(task, starter));
}

export function planProgress(tasks: Array<Pick<PlannerTask, "status">>): { done: number; total: number; percent: number } {
  const relevant = tasks.filter((task) => task.status !== "skipped");
  const done = relevant.filter((task) => task.status === "done").length;
  const total = relevant.length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}

export function giftIdeaCount(gifts: Array<Pick<GiftItem, "status">>): number {
  return gifts.length;
}

export function itemsToBuyCount(gifts: Array<Pick<GiftItem, "status">>): number {
  return gifts.filter((gift) => isToBuy(gift.status)).length;
}

export function exploreOnOwnStorageKey(profileId: string): string {
  return `tdg-planner-tasks-explore:${profileId}`;
}
