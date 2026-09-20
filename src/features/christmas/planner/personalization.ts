import {
  christmasDayParts,
  daysUntilChristmas,
  localDateParts,
  resolvePlanMode,
  upcomingChristmasYear,
} from "./date";
import { generateInitialPlan, recommendedToday, type GeneratedTask } from "./planGenerator";
import type { PlanMode, PreparedLevel } from "./types";

export const PLANNER_FUNNEL_VARIANT = "compact_personalized_v1" as const;
export const PERSONALIZATION_STORAGE_KEY = "tdg.christmas.planner.personalization.v1";

export const START_OPTIONS = [
  { id: "early", label: "Starting early" },
  { id: "november", label: "November" },
  { id: "december", label: "December" },
  { id: "late", label: "Help, I’m already late" },
] as const;

export const CHAOS_OPTIONS = [
  { id: "gifts", label: "Gifts" },
  { id: "budget", label: "Budget" },
  { id: "food", label: "Food" },
  { id: "hosting", label: "Hosting" },
  { id: "family", label: "Family plans" },
  { id: "everything", label: "Honestly, everything" },
] as const;

export const ROLE_OPTIONS = [
  { id: "hosting", label: "Hosting" },
  { id: "travelling", label: "Travelling" },
  { id: "staying_home", label: "Staying home" },
  { id: "mix", label: "A bit of everything" },
] as const;

export type StartOptionId = (typeof START_OPTIONS)[number]["id"];
export type ChaosOptionId = (typeof CHAOS_OPTIONS)[number]["id"];
export type RoleOptionId = (typeof ROLE_OPTIONS)[number]["id"];

export type PlannerPersonalizationAnswers = {
  start: StartOptionId | null;
  chaos: ChaosOptionId[];
  role: RoleOptionId | null;
};

export const EMPTY_PERSONALIZATION: PlannerPersonalizationAnswers = {
  start: null,
  chaos: [],
  role: null,
};

const START_IDS = new Set<string>(START_OPTIONS.map((row) => row.id));
const CHAOS_IDS = new Set<string>(CHAOS_OPTIONS.map((row) => row.id));
const ROLE_IDS = new Set<string>(ROLE_OPTIONS.map((row) => row.id));

export function isStartOptionId(value: string): value is StartOptionId {
  return START_IDS.has(value);
}

export function isChaosOptionId(value: string): value is ChaosOptionId {
  return CHAOS_IDS.has(value);
}

export function isRoleOptionId(value: string): value is RoleOptionId {
  return ROLE_IDS.has(value);
}

export function toggleChaosChoice(current: ChaosOptionId[], next: ChaosOptionId, max = 2): ChaosOptionId[] {
  if (next === "everything") return current.includes("everything") ? [] : ["everything"];
  const withoutEverything = current.filter((id) => id !== "everything");
  if (withoutEverything.includes(next)) return withoutEverything.filter((id) => id !== next);
  if (withoutEverything.length >= max) return [...withoutEverything.slice(1), next];
  return [...withoutEverything, next];
}

export function personalizationComplete(answers: PlannerPersonalizationAnswers): boolean {
  return Boolean(answers.start && answers.role && answers.chaos.length > 0);
}

export function readPlannerPersonalization(): PlannerPersonalizationAnswers {
  if (typeof window === "undefined") return EMPTY_PERSONALIZATION;
  try {
    const raw = window.localStorage.getItem(PERSONALIZATION_STORAGE_KEY);
    if (!raw) return EMPTY_PERSONALIZATION;
    const parsed = JSON.parse(raw) as Partial<PlannerPersonalizationAnswers>;
    const start = parsed.start && isStartOptionId(parsed.start) ? parsed.start : null;
    const role = parsed.role && isRoleOptionId(parsed.role) ? parsed.role : null;
    const chaos = Array.isArray(parsed.chaos)
      ? parsed.chaos.filter((id): id is ChaosOptionId => typeof id === "string" && isChaosOptionId(id)).slice(0, 2)
      : [];
    return { start, role, chaos };
  } catch {
    return EMPTY_PERSONALIZATION;
  }
}

export function persistPlannerPersonalization(answers: PlannerPersonalizationAnswers) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(answers));
  } catch {
    /* private mode */
  }
}

export function analyticsEnums(answers: PlannerPersonalizationAnswers) {
  return {
    start: answers.start,
    chaos: answers.chaos,
    role: answers.role,
  };
}

export function mapPersonalizationToPlanInput(answers: PlannerPersonalizationAnswers, now = new Date()) {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const daysLeft = daysUntilChristmas(now, tz);
  const season = upcomingChristmasYear(now, tz);
  const hosting = answers.role === "hosting" || answers.role === "mix";
  const travelling = answers.role === "travelling" || answers.role === "mix";
  const chaos = answers.chaos.includes("everything")
    ? (["gifts", "budget", "food", "hosting", "family"] as ChaosOptionId[])
    : answers.chaos;
  const caresAboutGifts = chaos.includes("gifts") || chaos.includes("everything") || chaos.length === 0;
  const prepared: PreparedLevel =
    answers.start === "late" || answers.start === "december" ? "rescue" : answers.start === "november" ? "some" : "starting";
  let mode: PlanMode = resolvePlanMode(daysLeft, prepared);
  if (answers.start === "late" || answers.start === "december") mode = "rescue";
  else if (answers.start === "november" && mode === "early") mode = "standard";
  return {
    tz,
    daysLeft,
    seasonYear: season,
    hosting,
    travelling,
    hasChildren: false,
    giftCount: caresAboutGifts ? 1 : 0,
    prepared,
    mode,
    chaos,
    rescueMode: mode === "rescue",
  };
}

const CHAOS_CATEGORY: Record<Exclude<ChaosOptionId, "everything">, GeneratedTask["category"][]> = {
  gifts: ["gifts", "shopping"],
  budget: ["gifts", "shopping"],
  food: ["food"],
  hosting: ["hosting", "decorating", "home"],
  family: ["family", "events", "cards"],
};

function chaosRank(task: GeneratedTask, chaos: ChaosOptionId[]): number {
  if (!chaos.length) return 1;
  const hit = chaos.some((id) => {
    if (id === "everything") return true;
    if (id === "budget" && task.template_key === "set_budget") return true;
    return CHAOS_CATEGORY[id].includes(task.category);
  });
  return hit ? 0 : 1;
}

export function startingFocus(tasks: GeneratedTask[], chaos: ChaosOptionId[], todayIso: string): GeneratedTask[] {
  const ranked = [...tasks].sort((a, b) => {
    const ca = chaosRank(a, chaos);
    const cb = chaosRank(b, chaos);
    if (ca !== cb) return ca - cb;
    const pri = (t: GeneratedTask) => (t.priority === "high" ? 0 : t.priority === "normal" ? 1 : 2);
    if (pri(a) !== pri(b)) return pri(a) - pri(b);
    return a.due_on < b.due_on ? -1 : 1;
  });
  const unique: GeneratedTask[] = [];
  for (const task of ranked) {
    if (unique.some((row) => row.template_key === task.template_key)) continue;
    unique.push(task);
    if (unique.length === 3) break;
  }
  if (unique.length < 3) {
    for (const task of recommendedToday(tasks, todayIso, 5)) {
      if (unique.some((row) => row.template_key === task.template_key)) continue;
      unique.push(task);
      if (unique.length === 3) break;
    }
  }
  return unique;
}

export function planningStyleLabel(answers: PlannerPersonalizationAnswers): string {
  const role = ROLE_OPTIONS.find((row) => row.id === answers.role)?.label;
  const chaos = answers.chaos
    .filter((id) => id !== "everything")
    .map((id) => CHAOS_OPTIONS.find((row) => row.id === id)?.label)
    .filter(Boolean);
  if (answers.chaos.includes("everything")) {
    return role ? `${role} · everything` : "Everything";
  }
  const chaosBit = chaos.slice(0, 2).join(" + ");
  if (role && chaosBit) return `${role} + ${chaosBit}`;
  return role || chaosBit || "Your Christmas";
}

export type PersonalizedPlannerPreview = {
  daysLeft: number;
  seasonYear: number;
  mode: PlanMode;
  rescueMode: boolean;
  hosting: boolean;
  travelling: boolean;
  prepared: PreparedLevel;
  styleLabel: string;
  generatedTaskCount: number;
  focus: GeneratedTask[];
  todayTasks: GeneratedTask[];
  giftTaskCount: number;
  budgetTaskCount: number;
  upcoming: GeneratedTask[];
  tasks: GeneratedTask[];
  peopleCount: number;
  giftPeopleCount: number;
  budgetUsd: number;
  celebrateLabel: string;
  menuLabel: string;
};

export function buildPersonalizedPreview(
  answers: PlannerPersonalizationAnswers,
  now = new Date(),
): PersonalizedPlannerPreview | null {
  if (!personalizationComplete(answers)) return null;
  const mapped = mapPersonalizationToPlanInput(answers, now);
  const today = localDateParts(now, mapped.tz);
  const tasks = generateInitialPlan({
    today,
    christmas: christmasDayParts(mapped.seasonYear),
    mode: mapped.mode,
    hosting: mapped.hosting,
    travelling: mapped.travelling,
    hasChildren: mapped.hasChildren,
    giftCount: mapped.giftCount,
    prepared: mapped.prepared,
    chaos: mapped.chaos,
  });
  const todayIso = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
  const giftTaskCount = tasks.filter((task) => task.category === "gifts" || task.category === "shopping").length;
  const budgetTaskCount = tasks.filter((task) => task.template_key === "set_budget").length;
  const giftPeople = mapped.giftCount > 0 ? 5 : 2;
  const peopleCount = mapped.hosting ? 8 : Math.max(4, giftPeople);
  const celebrateLabel = mapped.hosting ? "Christmas Eve dinner" : "Christmas Day at home";
  const menuLabel = mapped.chaos.includes("food") || mapped.hosting ? "suggested Christmas menu" : "a starter menu when you host";
  return {
    daysLeft: mapped.daysLeft,
    seasonYear: mapped.seasonYear,
    mode: mapped.mode,
    rescueMode: mapped.rescueMode,
    hosting: mapped.hosting,
    travelling: mapped.travelling,
    prepared: mapped.prepared,
    styleLabel: planningStyleLabel(answers),
    generatedTaskCount: tasks.length,
    focus: startingFocus(tasks, mapped.chaos, todayIso),
    todayTasks: recommendedToday(tasks, todayIso, 3),
    giftTaskCount,
    budgetTaskCount,
    upcoming: [...tasks].sort((a, b) => a.due_on.localeCompare(b.due_on)).slice(0, 3),
    tasks,
    peopleCount,
    giftPeopleCount: giftPeople,
    budgetUsd: 1200,
    celebrateLabel,
    menuLabel,
  };
}

/** Prefill account onboarding after purchase without extra questions. */
export function onboardingSeedFromPersonalization(answers: PlannerPersonalizationAnswers) {
  const mapped = mapPersonalizationToPlanInput(answers);
  return {
    hosting: mapped.hosting,
    travelling: mapped.travelling,
    prepared_level: mapped.prepared,
    plan_mode: mapped.mode,
  };
}
