import { sanitizeChristmasAnalyticsMetadata } from "./privacy/privacyCore";

export const CHRISTMAS_FUNNEL_EVENT_PATH = "/api/christmas/funnel-event";

export const CHRISTMAS_FUNNEL_ALLOWED_EVENTS = [
  "christmas_page_view",
  "product_selected",
  "upload_started",
  "upload_completed",
  "style_selected",
  "personalization_completed",
  "preview_seen",
  "offer_seen",
  "checkout_started",
  "payment_sheet_opened",
  "purchase",
  "generation_started",
  "generation_success",
  "generation_failed",
  "download",
  "share",
  "upsell_viewed",
  "upsell_purchase",
  "christmas_email_queued",
  "christmas_email_sent",
  "christmas_email_failed",
  "christmas_email_suppressed",
  "abandoned_checkout_eligible",
  "abandoned_checkout_recovered",
  "cross_sell_sent",
  "cross_sell_clicked",
  "cross_sell_purchase",
  "santa_form_started",
  "santa_form_completed",
  "santa_script_generated",
  "santa_audio_generated",
  "santa_video_submitted",
  "santa_video_ready",
  "christmas_tree_view",
  "tree_creation_started",
  "tree_created",
  "tree_customized",
  "gift_added",
  "gift_reordered",
  "tree_share_enabled",
  "tree_share",
  "tree_shared",
  "shared_tree_view",
  "gift_opened",
  "reward_claimed",
  "free_gift_claimed",
  "gift_finder_started",
  "gift_finder_completed",
  "gift_finder_failed",
  "gift_finder_result_saved",
  "gift_finder_to_wishlist",
  "wishlist_page_view",
  "wishlist_creation_started",
  "wishlist_created",
  "wishlist_item_added",
  "wishlist_item_removed",
  "wishlist_item_reordered",
  "wishlist_share_enabled",
  "wishlist_share",
  "shared_wishlist_view",
  "wishlist_external_link_clicked",
  "wishlist_from_finder_item_added",
  "christmas_message_page_view",
  "message_generator_started",
  "message_generator_completed",
  "message_generator_failed",
  "message_copied",
  "message_to_card",
  "message_regenerated",
  "christmas_card_page_view",
  "card_creation_started",
  "card_style_selected",
  "card_layout_selected",
  "card_photo_added",
  "card_message_added",
  "card_preview_seen",
  "card_generated",
  "card_download",
  "card_share",
  "card_create_another",
] as const;

export type ChristmasFunnelEventName = (typeof CHRISTMAS_FUNNEL_ALLOWED_EVENTS)[number];

export const CHRISTMAS_FUNNEL_MAX_BODY_BYTES = 4096;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ChristmasFunnelIngestPayload = {
  event_name: string;
  funnel_session_id: string;
  event_id?: string;
  idempotency_key?: string;
  product_key?: string | null;
  package_key?: string | null;
  order_id?: string | null;
  user_id?: string | null;
  locale?: string | null;
  pathname?: string | null;
  landing_path?: string | null;
  device_type?: string | null;
  amount_cents?: number | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  affiliate_ref?: string | null;
  campaign_id?: string | null;
  adset_id?: string | null;
  ad_id?: string | null;
  has_fbclid?: boolean;
  referrer_host?: string | null;
  is_test_request?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type ValidatedChristmasFunnelIngest = {
  eventName: ChristmasFunnelEventName;
  funnelSessionId: string;
  eventId: string;
  idempotencyKey: string;
  productKey: string | null;
  packageKey: string | null;
  orderId: string | null;
  userId: string | null;
  locale: string | null;
  pathname: string | null;
  landingPath: string | null;
  deviceType: "mobile" | "tablet" | "desktop" | null;
  amountCents: number | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  affiliateRef: string | null;
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
  hasFbclid: boolean;
  referrerHost: string | null;
  metadata: Record<string, unknown>;
};

export type ChristmasIngestRejectReason =
  | "invalid_event"
  | "invalid_session"
  | "invalid_uuid"
  | "payload_too_large"
  | "malformed_json"
  | "oversized_field";

export class ChristmasFunnelIngestError extends Error {
  constructor(
    public readonly reason: ChristmasIngestRejectReason,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ChristmasFunnelIngestError";
  }
}

export function isChristmasFunnelEventName(value: string): value is ChristmasFunnelEventName {
  return (CHRISTMAS_FUNNEL_ALLOWED_EVENTS as readonly string[]).includes(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function newFunnelUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    const v = char === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function sanitizeFunnelText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const clipped = trimmed.slice(0, max);
  if (/[<>]/.test(clipped)) return null;
  if (/[\u0000-\u001F]/.test(clipped)) return null;
  return clipped;
}

function sanitizeDevice(value: unknown): ValidatedChristmasFunnelIngest["deviceType"] {
  const raw = String(value || "").toLowerCase();
  if (raw === "mobile" || raw === "tablet" || raw === "desktop") return raw;
  return null;
}

export function validateChristmasFunnelIngestPayload(
  raw: unknown,
): ValidatedChristmasFunnelIngest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ChristmasFunnelIngestError("malformed_json", 400, "Invalid payload");
  }
  const body = raw as ChristmasFunnelIngestPayload;
  const eventName = String(body.event_name || "").trim();
  if (!isChristmasFunnelEventName(eventName)) {
    throw new ChristmasFunnelIngestError("invalid_event", 400, "Invalid event_name");
  }
  if (!isUuid(body.funnel_session_id)) {
    throw new ChristmasFunnelIngestError("invalid_session", 400, "Invalid funnel_session_id");
  }
  const eventId = isUuid(body.event_id) ? body.event_id : newFunnelUuid();
  const idempotencyKey =
    sanitizeFunnelText(body.idempotency_key, 180) ||
    `${body.funnel_session_id}:${eventName}:${eventId}`;

  const orderId = body.order_id == null || body.order_id === "" ? null : String(body.order_id);
  if (orderId && !isUuid(orderId)) {
    throw new ChristmasFunnelIngestError("invalid_uuid", 400, "Invalid order_id");
  }
  const userId = body.user_id == null || body.user_id === "" ? null : String(body.user_id);
  if (userId && !isUuid(userId)) {
    throw new ChristmasFunnelIngestError("invalid_uuid", 400, "Invalid user_id");
  }

  let amountCents: number | null = null;
  if (body.amount_cents != null && body.amount_cents !== ("" as unknown)) {
    const n = Number(body.amount_cents);
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
      throw new ChristmasFunnelIngestError("oversized_field", 400, "Invalid amount_cents");
    }
    amountCents = Math.round(n);
  }

  return {
    eventName,
    funnelSessionId: body.funnel_session_id,
    eventId,
    idempotencyKey: idempotencyKey.slice(0, 180),
    productKey: sanitizeFunnelText(body.product_key, 80),
    packageKey: sanitizeFunnelText(body.package_key, 80),
    orderId,
    userId,
    locale: sanitizeFunnelText(body.locale, 16),
    pathname: sanitizeFunnelText(body.pathname, 120),
    landingPath: sanitizeFunnelText(body.landing_path, 120),
    deviceType: sanitizeDevice(body.device_type),
    amountCents,
    utmSource: sanitizeFunnelText(body.utm_source, 120),
    utmMedium: sanitizeFunnelText(body.utm_medium, 120),
    utmCampaign: sanitizeFunnelText(body.utm_campaign, 120),
    utmContent: sanitizeFunnelText(body.utm_content, 120),
    utmTerm: sanitizeFunnelText(body.utm_term, 120),
    affiliateRef: sanitizeFunnelText(body.affiliate_ref, 120),
    campaignId: sanitizeFunnelText(body.campaign_id, 120),
    adsetId: sanitizeFunnelText(body.adset_id, 120),
    adId: sanitizeFunnelText(body.ad_id, 120),
    hasFbclid: Boolean(body.has_fbclid),
    referrerHost: sanitizeFunnelText(body.referrer_host, 120),
    metadata:
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? sanitizeChristmasAnalyticsMetadata(body.metadata)
        : {},
  };
}

export function christmasEventRowFromValidated(
  validated: ValidatedChristmasFunnelIngest,
  environment: string,
  isTest: boolean,
) {
  return {
    event_name: validated.eventName,
    funnel_session_id: validated.funnelSessionId,
    idempotency_key: validated.idempotencyKey,
    product_key: validated.productKey,
    package_key: validated.packageKey,
    order_id: validated.orderId,
    user_id: validated.userId,
    locale: validated.locale,
    pathname: validated.pathname,
    landing_path: validated.landingPath,
    device_type: validated.deviceType,
    amount_cents: validated.amountCents,
    utm_source: validated.utmSource,
    utm_medium: validated.utmMedium,
    utm_campaign: validated.utmCampaign,
    utm_content: validated.utmContent,
    utm_term: validated.utmTerm,
    affiliate_ref: validated.affiliateRef,
    campaign_id: validated.campaignId,
    adset_id: validated.adsetId,
    ad_id: validated.adId,
    has_meta_click: validated.hasFbclid,
    referrer_host: validated.referrerHost,
    client_event_id: validated.eventId,
    is_test: isTest,
    environment,
    metadata: validated.metadata,
  };
}
