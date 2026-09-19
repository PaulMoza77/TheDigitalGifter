/**
 * Compact Intelligence Engine contract for Christmas Copilot.
 * Facts and scores are computed here — the LLM (later) must not invent them.
 */

import type { PlanMode } from "../types";

export type InsightSeverity = "info" | "warn" | "urgent";

export type PlannerInsightKind =
  | "overdue_tasks"
  | "weekend_focus"
  | "missing_gifts"
  | "budget_unset"
  | "budget_over"
  | "budget_tight"
  | "no_menu"
  | "trip_deadline"
  | "rescue_mode"
  | "low_priority_skip"
  | "caught_up";

export type PlannerInsight = {
  id: string;
  kind: PlannerInsightKind;
  module: string;
  severity: InsightSeverity;
  title: string;
  fact: string;
  href?: string;
};

export type NextBestAction = {
  id: string;
  label: string;
  reason: string;
  href: string;
  module: string;
};

export type PlannerSnapshot = {
  version: string;
  seasonYear: number;
  todayIso: string;
  daysLeft: number;
  planMode: PlanMode;
  readinessPercent: number;
  hosting: boolean;
  travelling: boolean;
  hasChildren: boolean;
  currency: string;
  openTasks: number;
  overdueTasks: number;
  highPriorityOpen: number;
  recipientCount: number;
  giftsWithoutPlan: number;
  plannedGifts: number;
  wrappedGifts: number;
  budgetPlannedMinor: number;
  budgetSpentMinor: number;
  budgetRemainingMinor: number | null;
  mealsCount: number;
  groceryNeedCount: number;
  tripStartOn: string | null;
  weekendTaskTitles: string[];
  overdueTaskTitles: string[];
  skippableTaskTitles: string[];
  /** First names / display names already shown in the Planner UI. Never notes. */
  missingGiftNames: string[];
};

export type IntelligenceBundle = {
  snapshot: PlannerSnapshot;
  insights: PlannerInsight[];
  nextBestActions: NextBestAction[];
};

export type IntelligenceInput = {
  seasonYear: number;
  todayIso: string;
  daysLeft: number;
  planMode: PlanMode;
  readinessPercent: number;
  hosting: boolean;
  travelling: boolean;
  hasChildren: boolean;
  currency: string;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_on: string | null;
    category: string;
  }>;
  recipients: Array<{ id: string; display_name: string }>;
  gifts: Array<{ recipient_id: string; status: string }>;
  budgetPlannedMinor: number;
  budgetSpentMinor: number;
  mealsCount: number;
  groceryNeedCount?: number;
  tripStartOn?: string | null;
};
