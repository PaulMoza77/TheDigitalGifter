import type { PreviewFunnelDefinition } from "../pet-funnel-shared/config";
import { v3FlashSale } from "./v3FlashSale";
import {
  PET_V3_COMPARE_PRICE_DISPLAY,
  PET_V3_PREVIEW_SCENE,
  PET_V3_PRICE_CENTS,
  PET_V3_PRICE_DISPLAY,
  PET_V3_ROUTE,
  PET_V3_SPECIES,
} from "./types";

export const PET_V3_FUNNEL_CONFIG: PreviewFunnelDefinition = {
  version: "v3",
  species: PET_V3_SPECIES,
  routePath: PET_V3_ROUTE,
  previewScene: PET_V3_PREVIEW_SCENE,
  funnelVariant: "v3",
  funnelVariantAnalytics: "v3_cat_preview",
  priceCents: PET_V3_PRICE_CENTS,
  priceDisplay: PET_V3_PRICE_DISPLAY,
  compareAtDisplay: PET_V3_COMPARE_PRICE_DISPLAY,
  copy: {
    pageTitle: "See your cat’s secret lives | My Pet’s Secret Life",
    pageDescription:
      "One photo. 12 secret lives. 2 cinematic clips. Upload one cat photo for a free royal ruler preview. No card required for the preview.",
    landingEyebrow: "Try it free",
    landingHeadline: "One photo. 12 secret lives. 2 cinematic clips.",
    landingSubhead:
      "Upload one clear photo of your cat and get a free cinematic preview as a royal ruler — no card required.",
    landingCta: "Create my free preview",
    landingFooter: "Free preview first — card only if you unlock the collection.",
    closingHeadline: "One photo. 12 secret lives. 2 cinematic clips.",
    closingSubhead: (price) =>
      `Upload one cat photo for a free royal preview. Unlock all 12 secret lives and 2 mini clips for ${price}.`,
    photoHeadline: "One clear cat photo.",
    photoSubhead:
      "Face toward the camera, both eyes visible, even light. One cat only — no group shots, dogs, or heavy filters.",
    generateCta: "Create my free preview",
    generatingHeadline: "Creating your cat’s royal preview",
    generatingSubhead:
      "We’re turning your cat into a cinematic royal ruler. This is one free preview — not the full collection yet.",
    generatingStatus: [
      "Reading your cat photo",
      "Starting your royal ruler preview",
      "Still working — usually under 30 seconds",
    ],
    previewEyebrow: "Free cinematic preview",
    previewHeadline: (petName) =>
      petName?.trim() ? `${petName.trim()} the royal ruler` : "Your cat the royal ruler",
    previewSubhead:
      "Your cat’s secret life starts here. Unlock the full collection to see every incredible transformation.",
    previewImageAlt: "Your cat as a royal ruler in a cinematic portrait",
    mockPreviewNote:
      "Prototype preview: live AI generation is off in this environment, so this is your photo with royal-styled framing.",
    unlockCta: (price) => `Unlock all 12 lives + 2 clips for ${price}`,
    offerHeadline: "Unlock your cat’s secret life collection",
    offerSubhead: (headline) => `${headline}. One-time. No subscription.`,
    packHeadline: (price, compareAt, saleActive) =>
      saleActive
        ? `Get 12 secret lives and 2 mini clips for only ${price}`
        : `Get 12 secret lives and 2 mini clips for ${price}`,
  },
};

export function v3PackOfferCopy(nowMs = Date.now()) {
  const sale = v3FlashSale(nowMs);
  return {
    saleActive: sale.saleActive,
    headline: PET_V3_FUNNEL_CONFIG.copy.packHeadline(
      sale.priceDisplay,
      sale.compareAtDisplay,
      sale.saleActive,
    ),
    priceDisplay: sale.priceDisplay,
    compareAtDisplay: sale.compareAtDisplay,
    amountCents: sale.amountCents,
    expiresAt: sale.expiresAt,
  };
}
