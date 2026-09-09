import { trackChristmasEvent } from "../analytics";
import type { ChristmasFunnelEventName } from "../funnelEventContract";

const PATH = "/christmas";
const PRODUCT = "christmas_hub";

export function trackHubEvent(
  eventName: ChristmasFunnelEventName,
  metadata?: Record<string, unknown>,
  productKey?: string,
) {
  void trackChristmasEvent(eventName, {
    productKey: productKey ?? PRODUCT,
    pathname: PATH,
    metadata: metadata ?? null,
  });
}
