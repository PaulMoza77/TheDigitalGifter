import { formatPlannerMoney } from "../intelligence/budgetIntelligence";
import type { PlannerIntelligence } from "../intelligence/types";
import type { PlannerSnapshot } from "../intelligence/types";
import type { PlannerAccess } from "../types";
import { hasCompletePlanner, hasFeature } from "../entitlements";
import { HOME_GRID_MODULES, type PlannerModuleDef } from "./modules";

const GIFT_DONE = ["planned", "ordered", "arrived", "hidden", "wrapped", "given"];

export type ModuleCardModel = PlannerModuleDef & {
  locked: boolean;
  progress: string | null;
  empty: boolean;
};

export type HomeNextAction = {
  href: string;
  label: string;
};

export type HomeProgressModel = {
  percent: number;
  done: number;
  total: number;
};

export function moduleLockedForAccess(mod: PlannerModuleDef, access: PlannerAccess | null | undefined): boolean {
  if (!mod.feature) return false;
  return !hasFeature(access, mod.feature);
}

export function giftCardProgress(snapshot: PlannerSnapshot): { text: string; empty: boolean } {
  const total = snapshot.gifts.length;
  if (!total) return { text: "No gifts yet", empty: true };
  const done = snapshot.gifts.filter((g) => GIFT_DONE.includes(g.status)).length;
  return { text: `${done} / ${total} done`, empty: false };
}

export function mealCardProgress(snapshot: PlannerSnapshot): { text: string; empty: boolean } {
  const n = snapshot.meals.length;
  if (!n) return { text: "Plan your first meal", empty: true };
  return { text: `${n} planned`, empty: false };
}

export function budgetCardProgress(snapshot: PlannerSnapshot, spentMinor: number | null): { text: string; empty: boolean } {
  const total = snapshot.profile.totalBudgetMinor;
  if (!total) return { text: "Set your Christmas budget", empty: true };
  const spent = spentMinor ?? 0;
  return {
    text: `${formatPlannerMoney(spent, snapshot.currency)} of ${formatPlannerMoney(total, snapshot.currency)}`,
    empty: false,
  };
}

export function recipeCardProgress(snapshot: PlannerSnapshot): { text: string; empty: boolean } {
  const n = snapshot.recipes.length;
  if (!n) return { text: "Save your first recipe", empty: true };
  return { text: `${n} saved`, empty: false };
}

export function buildModuleCards(input: {
  snapshot: PlannerSnapshot;
  access: PlannerAccess | null | undefined;
  spentMinor?: number | null;
}): ModuleCardModel[] {
  const { snapshot, access } = input;
  const spent = input.spentMinor ?? 0;
  const homeDone = snapshot.home.filter((h) => h.status === "done").length;
  const cardsPrepared = snapshot.cards.filter((c) => c.status === "prepared" || c.status === "sent").length;

  return HOME_GRID_MODULES.map((mod) => {
    let progress: string | null = null;
    let empty = false;
    if (mod.id === "gifts") {
      const row = giftCardProgress(snapshot);
      progress = row.text;
      empty = row.empty;
    } else if (mod.id === "meals") {
      const row = mealCardProgress(snapshot);
      progress = row.text;
      empty = row.empty;
    } else if (mod.id === "budget") {
      const row = budgetCardProgress(snapshot, spent);
      progress = row.text;
      empty = row.empty;
    } else if (mod.id === "recipes") {
      const row = recipeCardProgress(snapshot);
      progress = row.text;
      empty = row.empty;
    } else if (mod.id === "calendar") {
      if (snapshot.events.length) progress = `${snapshot.events.length} dated`;
    } else if (mod.id === "hosting") {
      if (snapshot.guests.length) progress = `${snapshot.guests.length} guests`;
      else if (homeDone) progress = `${homeDone} home items done`;
    } else if (mod.id === "travel") {
      if (!snapshot.trips.length) {
        progress = snapshot.profile.travelling ? "Add your first trip" : null;
        empty = snapshot.profile.travelling && snapshot.trips.length === 0;
      } else {
        progress = `${snapshot.trips.length} ${snapshot.trips.length === 1 ? "trip" : "trips"} planned`;
      }
    } else if (mod.id === "traditions") {
      const set = snapshot.traditions.filter((t) => t.status === "planned" || t.status === "done" || t.scheduled_on);
      if (set.length) progress = `${set.length} planned`;
    } else if (mod.id === "cards") {
      if (snapshot.cards.length) progress = `${cardsPrepared} / ${snapshot.cards.length} ready`;
    }
    return {
      ...mod,
      locked: moduleLockedForAccess(mod, access),
      progress,
      empty,
    };
  });
}

export function homeProgressFromReadiness(percent: number, cards: ModuleCardModel[]): HomeProgressModel {
  const started = cards.filter((c) => !c.empty && Boolean(c.progress)).length;
  return {
    percent: Math.max(0, Math.min(100, percent)),
    done: started,
    total: cards.length,
  };
}

export function collectHomeNextActions(input: {
  snapshot: PlannerSnapshot;
  intel?: PlannerIntelligence | null;
}): HomeNextAction[] {
  const { snapshot, intel } = input;
  const rows: HomeNextAction[] = [];
  const gifts = giftCardProgress(snapshot);
  const meals = mealCardProgress(snapshot);
  const budget = budgetCardProgress(snapshot, intel?.budget.spentMinor ?? 0);

  if (intel?.nextBestAction) {
    rows.push({ href: intel.nextBestAction.href, label: intel.nextBestAction.title });
  }
  if (gifts.empty) rows.push({ href: "/account/christmas/gifts", label: "Finish gift list" });
  else if (snapshot.gifts.some((g) => g.status === "idea" || g.status === "planned")) {
    rows.push({ href: "/account/christmas/gifts", label: "Finish gift list" });
  }
  if (meals.empty) rows.push({ href: "/account/christmas/food", label: "Plan Christmas dinner" });
  if (budget.empty) rows.push({ href: "/account/christmas/budget", label: "Set your budget" });

  const seen = new Set<string>();
  const unique: HomeNextAction[] = [];
  for (const row of rows) {
    const key = `${row.href}:${row.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.length === 3) break;
  }
  return unique;
}

export function showPlannerUpgrade(access: PlannerAccess | null | undefined): boolean {
  return !hasCompletePlanner(access);
}
