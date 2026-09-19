import { daysUntilChristmas, isoDate, localDateParts, resolvePlanMode } from "../date";
import type { PlannerProfile } from "../types";
import type { PlannerSnapshot } from "./types";
import {
  toSnapshotBudget,
  toSnapshotGift,
  toSnapshotRecipient,
  toSnapshotTask,
  type SnapshotCard,
  type SnapshotDish,
  type SnapshotEvent,
  type SnapshotGrocery,
  type SnapshotGuest,
  type SnapshotHome,
  type SnapshotMeal,
  type SnapshotRecipe,
  type SnapshotTradition,
  type SnapshotTrip,
} from "./types";
import type { BudgetEntry, GiftItem, GiftRecipient, PlannerTask } from "../types";

export type WorkspaceRows = {
  profile: PlannerProfile;
  tasks: PlannerTask[];
  recipients: GiftRecipient[];
  gifts: GiftItem[];
  budgetEntries: BudgetEntry[];
  meals?: SnapshotMeal[];
  dishes?: SnapshotDish[];
  recipes?: SnapshotRecipe[];
  grocery?: SnapshotGrocery[];
  guests?: SnapshotGuest[];
  home?: SnapshotHome[];
  trips?: SnapshotTrip[];
  events?: SnapshotEvent[];
  cards?: SnapshotCard[];
  traditions?: SnapshotTradition[];
  now?: Date;
};

export function buildPlannerSnapshot(rows: WorkspaceRows): PlannerSnapshot {
  const profile = rows.profile;
  const now = rows.now ?? new Date();
  const tz = profile.timezone;
  const today = isoDate(localDateParts(now, tz));
  const daysLeft = daysUntilChristmas(now, tz);
  const chaos = Array.isArray(profile.metadata?.chaos) ? (profile.metadata?.chaos as string[]) : [];
  return {
    season: profile.season_year,
    today,
    daysLeft,
    timezone: tz,
    currency: profile.currency || "eur",
    planMode: resolvePlanMode(daysLeft, profile.prepared_level),
    profile: {
      id: profile.id,
      userId: profile.user_id,
      hosting: profile.hosting,
      travelling: profile.travelling,
      hasChildren: profile.has_children,
      preparedLevel: profile.prepared_level,
      chaosAreas: chaos,
      totalBudgetMinor: profile.total_budget_minor,
      onboardingCompleted: Boolean(profile.onboarding_completed_at),
    },
    tasks: rows.tasks.map(toSnapshotTask),
    recipients: rows.recipients.map(toSnapshotRecipient),
    gifts: rows.gifts.map(toSnapshotGift),
    budgetEntries: rows.budgetEntries.map(toSnapshotBudget),
    meals: rows.meals || [],
    dishes: rows.dishes || [],
    recipes: rows.recipes || [],
    grocery: rows.grocery || [],
    guests: rows.guests || [],
    home: rows.home || [],
    trips: rows.trips || [],
    events: rows.events || [],
    cards: rows.cards || [],
    traditions: rows.traditions || [],
  };
}
