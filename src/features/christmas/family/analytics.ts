import { trackChristmasEvent } from "../analytics";
import type { ChristmasFunnelEventName } from "../funnelEventContract";

export type FamilyTrackEvent =
  | "christmas_family_page_view"
  | "christmas_family_upload_started"
  | "christmas_family_upload_completed"
  | "christmas_family_style_selected"
  | "christmas_family_generation_started"
  | "christmas_family_generation_completed"
  | "christmas_family_style_retry"
  | "christmas_family_downloaded"
  | "christmas_family_shared"
  | "christmas_family_card_cross_sell";

export async function trackFamilyEvent(
  eventName: FamilyTrackEvent | ChristmasFunnelEventName,
  extra?: {
    productKey?: string | null;
    packageKey?: string | null;
    orderId?: string | null;
    styleKey?: string | null;
    amountCents?: number | null;
    pathname?: string | null;
    locale?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  const metadata: Record<string, unknown> = {
    surface: "christmas_family",
    ...(extra?.metadata || {}),
  };
  delete metadata.image;
  delete metadata.imageDataUrl;
  delete metadata.email;
  delete metadata.sourcePath;

  await trackChristmasEvent(eventName as ChristmasFunnelEventName, {
    productKey: extra?.productKey ?? "christmas_family",
    packageKey: extra?.packageKey,
    orderId: extra?.orderId,
    styleKey: extra?.styleKey,
    amountCents: extra?.amountCents,
    pathname: extra?.pathname ?? "/christmas/family",
    locale: extra?.locale,
    metadata,
  });
}
