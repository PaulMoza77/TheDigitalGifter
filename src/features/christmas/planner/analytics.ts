import { trackChristmasEvent } from "@/features/christmas/analytics";
import type { ChristmasFunnelEventName } from "@/features/christmas/funnelEventContract";
import type { PlannerFeatureKey } from "./types";

const PLANNER_EVENTS = [
  "planner_onboarding_started",
  "planner_onboarding_completed",
  "planner_dashboard_viewed",
  "planner_task_completed",
  "planner_recipient_added",
  "planner_gift_added",
  "planner_budget_set",
  "planner_meal_created",
  "planner_recipe_saved",
  "planner_guest_added",
  "planner_activity_scheduled",
  "planner_module_opened",
  "planner_paywall_viewed",
  "planner_upgrade_clicked",
  "planner_landing_view",
  "planner_cta_clicked",
  "planner_package_viewed",
  "planner_package_selected",
  "planner_addon_selected",
  "planner_checkout_started",
  "planner_wallet_presented",
  "planner_payment_submitted",
  "planner_purchase",
  "planner_purchase_failed",
  "planner_welcome_view",
  "planner_claim_started",
  "planner_claim_completed",
  "planner_opened",
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

export function sanitizePlannerMetadata(
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!metadata) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lk = key.toLowerCase();
    if (BLOCKED_META_KEYS.some((b) => lk === b || lk.includes(b))) continue;
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
    productKey: "christmas_planner",
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
