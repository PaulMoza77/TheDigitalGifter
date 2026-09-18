import { getChristmasFunnelSessionId, trackChristmasEvent } from "../analytics";
import type { ChristmasFunnelEventName } from "../funnelEventContract";
import { PLANNER_PRODUCT_KEY } from "./commerce";
import { PLANNER_FUNNEL_VARIANT } from "./personalization";
import { sanitizePlannerMetadata } from "./analytics";

export const PLANNER_LANDING_PATH = "/christmas/planner";

export function trackPlannerFunnel(
  eventName: ChristmasFunnelEventName,
  extra?: {
    packageKey?: string | null;
    orderId?: string | null;
    amountCents?: number | null;
    pathname?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  void trackChristmasEvent(eventName, {
    productKey: PLANNER_PRODUCT_KEY,
    packageKey: extra?.packageKey,
    orderId: extra?.orderId,
    amountCents: extra?.amountCents,
    pathname: extra?.pathname ?? PLANNER_LANDING_PATH,
    metadata: sanitizePlannerMetadata({
      funnel_variant: PLANNER_FUNNEL_VARIANT,
      ...(extra?.metadata || {}),
    }),
  });
}

export { getChristmasFunnelSessionId, PLANNER_FUNNEL_VARIANT };
