import { trackChristmasEvent } from "@/features/christmas/analytics";
import type { ChristmasFunnelEventName } from "@/features/christmas/funnelEventContract";
import type { PlannerFeatureKey } from "./types";

const PLANNER_EVENTS = [
  "planner_onboarding_started",
  "planner_onboarding_completed",
  "planner_dashboard_viewed",
  "planner_task_added",
  "planner_task_completed",
  "planner_task_rescheduled",
  "planner_recipient_added",
  "planner_gift_added",
  "planner_gift_status_changed",
  "planner_budget_set",
  "planner_budget_updated",
  "planner_meal_created",
  "planner_event_created",
  "planner_ai_opened",
  "copilot_opened",
  "copilot_turn",
  "planner_recipe_saved",
  "planner_guest_added",
  "planner_activity_scheduled",
  "planner_module_opened",
  "planner_paywall_viewed",
  "planner_upgrade_clicked",
  "planner_landing_view",
  "planner_teaser_viewed",
  "planner_teaser_cta_clicked",
  "planner_value_section_viewed",
  "planner_demo_viewed",
  "planner_demo_tab_clicked",
  "planner_build_started",
  "planner_cta_clicked",
  "planner_personalization_q1",
  "planner_personalization_q2",
  "planner_personalization_q3",
  "planner_personalization_completed",
  "planner_preview_viewed",
  "planner_package_viewed",
  "planner_package_selected",
  "planner_addon_selected",
  "planner_checkout_viewed",
  "planner_checkout_started",
  "planner_wallet_presented",
  "planner_payment_submitted",
  "planner_purchase",
  "planner_purchase_failed",
  "planner_welcome_view",
  "planner_claim_started",
  "planner_claim_completed",
  "planner_opened",
  "gift_concierge_opened",
  "gift_concierge_generated",
  "gift_concierge_refined",
  "gift_concierge_suggestion_added",
  "gift_concierge_failed",
] as const;

export type PlannerAnalyticsEvent = (typeof PLANNER_EVENTS)[number];

const BLOCKED_META_KEYS = [
  "name",
  "display_name",
  "recipient",
  "gift",
  "notes",
  "title",
  "address",
  "destination",
  "budget",
  "price",
  "email",
];

const EXACT_ONLY_BLOCKED = new Set(["budget", "price", "gift"]);

export function sanitizePlannerMetadata(
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!metadata) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lk = key.toLowerCase();
    if (
      BLOCKED_META_KEYS.some((b) =>
        EXACT_ONLY_BLOCKED.has(b) ? lk === b : lk === b || lk.includes(b),
      )
    ) {
      continue;
    }
    if (typeof value === "string") {
      if (value.length > 40) continue;
      out[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

export function trackPlannerEvent(
  eventName: PlannerAnalyticsEvent,
  extra?: {
    module?: string;
    feature?: PlannerFeatureKey;
    planMode?: string;
    countBucket?: string;
    packageKey?: string | null;
    orderId?: string | null;
    amountCents?: number | null;
    metadata?: Record<string, unknown>;
  },
): void {
  void trackChristmasEvent(eventName as ChristmasFunnelEventName, {
    productKey: "christmas_planner_2026",
    packageKey: extra?.packageKey,
    orderId: extra?.orderId,
    amountCents: extra?.amountCents,
    metadata: sanitizePlannerMetadata({
      module: extra?.module,
      feature: extra?.feature,
      plan_mode: extra?.planMode,
      count_bucket: extra?.countBucket,
      ...(extra?.metadata || {}),
    }),
  });
}

export { PLANNER_EVENTS };
