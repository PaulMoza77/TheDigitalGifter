import {
  STORY_CURRENCY,
  STORY_PRICE_CENTS,
  STORY_PRICE_RON_CENTS,
  STORY_PRICE_USD_CENTS,
  STORY_PRODUCT_KEY,
  storyPriceForMarket,
} from "./types";

/** Primary offer — add-ons behind flags until delivery is validated. */
export const STORY_OFFER = {
  productKey: STORY_PRODUCT_KEY,
  name: "Our Christmas Story",
  priceCents: STORY_PRICE_CENTS,
  currency: STORY_CURRENCY,
  displayPrice: "$34.99",
  markets: {
    us: storyPriceForMarket("us"),
    ro: storyPriceForMarket("ro"),
  },
  /** Explicit approved prep amounts (cents). */
  approvedPriceUsdCents: STORY_PRICE_USD_CENTS,
  approvedPriceRonCents: STORY_PRICE_RON_CENTS,
  promise:
    "Turn your favorite memories into a personal song, a beautiful film, and a surprise made just for them.",
  includes: [
    "Personalized private gift website",
    "Recipient name and custom dedication",
    "AI-assisted emotional story (buyer-reviewed)",
    "One custom original song",
    "Cinematic memory film from your photos",
    "Interactive gallery",
    "One meaningful hidden surprise",
    "Printable gift card with QR code",
    "Buyer dashboard for review and delivery",
  ] as const,
  timeline:
    "After payment: typically 24–72 hours for song + film production and quality check. You approve before anyone else sees it.",
  taxesNote:
    "Displayed price is the product total. Applicable taxes (including VAT/OSS where required) are calculated at checkout when live payments are enabled.",
  addOns: {
    extraSong: { label: "Extra Song", priceCents: 1700, enabled: false },
    extendedFilm: {
      label: "Extended Memory Film",
      priceCents: 1200,
      enabled: false,
    },
    surpriseCalendar: {
      label: "12-Day Surprise Calendar",
      priceCents: 1200,
      enabled: false,
    },
  },
  /** Hard kill switch — never charge without explicit authorization. */
  checkoutEnabled: false,
  stripeMode: "disabled" as const,
} as const;

export type StoryOffer = typeof STORY_OFFER;
