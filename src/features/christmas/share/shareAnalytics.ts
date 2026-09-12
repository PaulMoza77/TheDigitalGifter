import { getChristmasFunnelSessionId } from "../analytics";
import { CHRISTMAS_FUNNEL_EVENT_PATH, newFunnelUuid } from "../funnelEventContract";
import { sanitizeResultShareAnalyticsMeta } from "./shareLogic";

/**
 * Privacy-safe analytics for capability-bearing share pages.
 * Never sends location.search, media URLs, public/owner/share tokens, or referrers.
 * Uses the existing `share` event so no global funnel allowlist change is required.
 */
export async function trackResultShareEvent(
  action: "result_share_enabled" | "result_share_revoked" | "shared_result_view" | "result_share_copied",
  extra?: {
    productKey?: string | null;
    orderId?: string | null;
    generationId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  if (typeof window === "undefined") return;
  const eventId = newFunnelUuid();
  const sessionId = getChristmasFunnelSessionId();
  const metadata = sanitizeResultShareAnalyticsMeta({
    action,
    ...(extra?.generationId ? { generation_id: extra.generationId } : {}),
    ...(extra?.metadata || {}),
  });
  const body = {
    event_name: "share",
    funnel_session_id: sessionId,
    event_id: eventId,
    idempotency_key: `${sessionId}:share:${eventId}`,
    product_key: extra?.productKey || "christmas_photo",
    order_id: extra?.orderId || null,
    pathname: window.location.pathname.slice(0, 120),
    landing_path: window.location.pathname.slice(0, 120),
    metadata,
  };
  try {
    await fetch(CHRISTMAS_FUNNEL_EVENT_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Analytics must never break sharing.
  }
}
