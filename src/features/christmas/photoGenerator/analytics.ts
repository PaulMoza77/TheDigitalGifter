import { trackChristmasEvent } from "../analytics";
import type { ChristmasFunnelEventName } from "../funnelEventContract";

/**
 * Photo-generator analytics surface.
 * Prefer dedicated event names; never send image bytes or PII in metadata.
 */
export type PhotoGeneratorTrackEvent =
  | "christmas_photo_generator_page_view"
  | "christmas_photo_upload_started"
  | "christmas_photo_upload_completed"
  | "christmas_photo_subject_selected"
  | "christmas_photo_style_selected"
  | "christmas_photo_generation_started"
  | "christmas_photo_generation_completed"
  | "christmas_photo_style_retry"
  | "christmas_photo_downloaded"
  | "christmas_photo_shared"
  | "christmas_photo_card_cross_sell";

export async function trackPhotoGeneratorEvent(
  eventName: PhotoGeneratorTrackEvent | ChristmasFunnelEventName,
  extra?: {
    productKey?: string | null;
    packageKey?: string | null;
    orderId?: string | null;
    styleKey?: string | null;
    amountCents?: number | null;
    pathname?: string | null;
    locale?: string | null;
    subject?: string | null;
    category?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  const metadata: Record<string, unknown> = {
    surface: "christmas_photo_generator",
    ...(extra?.subject ? { subject: extra.subject } : {}),
    ...(extra?.category ? { category: extra.category } : {}),
    ...(extra?.metadata || {}),
  };
  // Strip anything that looks like binary / PII-heavy fields if callers slip.
  delete metadata.image;
  delete metadata.imageDataUrl;
  delete metadata.email;
  delete metadata.sourcePath;

  await trackChristmasEvent(eventName as ChristmasFunnelEventName, {
    productKey: extra?.productKey ?? "christmas_photo",
    packageKey: extra?.packageKey,
    orderId: extra?.orderId,
    styleKey: extra?.styleKey,
    amountCents: extra?.amountCents,
    pathname: extra?.pathname ?? "/christmas/photo-generator",
    locale: extra?.locale,
    metadata,
  });
}
