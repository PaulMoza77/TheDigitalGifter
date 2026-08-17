export const PET_UPSELL_KEYS = [
  "gift_pack",
  "holiday_card",
  "print_pack",
  "retry_3_scenes",
] as const;

export type PetUpsellKey = (typeof PET_UPSELL_KEYS)[number];

export type PetUpsellScope = "scene" | "order";

export type PetUpsellDefinition = {
  key: PetUpsellKey;
  name: string;
  description: string;
  priceCents: number;
  currency: "usd";
  scope: PetUpsellScope;
  cta: string;
  purchasedCta: string;
};

export const PET_UPSELL_OFFERS: Record<PetUpsellKey, PetUpsellDefinition> = {
  gift_pack: {
    key: "gift_pack",
    name: "Gift Pack",
    description: "Phone wallpaper, Instagram square & story, plus a share card — instant download.",
    priceCents: 1500,
    currency: "usd",
    scope: "scene",
    cta: "Get Gift Pack — $15",
    purchasedCta: "Download Gift Pack",
  },
  holiday_card: {
    key: "holiday_card",
    name: "Holiday Card Pack",
    description: "Print-ready 5×7 holiday card with your pet’s portrait and name.",
    priceCents: 900,
    currency: "usd",
    scope: "scene",
    cta: "Get Holiday Card — $9",
    purchasedCta: "Download Holiday Card",
  },
  print_pack: {
    key: "print_pack",
    name: "Print Pack",
    description: "Crop guide and print-ready file sized to your portrait’s real resolution.",
    priceCents: 1200,
    currency: "usd",
    scope: "scene",
    cta: "Get Print Pack — $12",
    purchasedCta: "Download Print File",
  },
  retry_3_scenes: {
    key: "retry_3_scenes",
    name: "3-Scene Retry",
    description: "Pick up to 3 portraits to regenerate with the same pet photo.",
    priceCents: 900,
    currency: "usd",
    scope: "order",
    cta: "Retry 3 scenes — $9",
    purchasedCta: "Regeneration queued",
  },
};

export const PRINT_DPI = 150;

export type PrintEligibility = {
  eligible: boolean;
  maxSizeLabel: string | null;
  maxWidthInches: number | null;
  maxHeightInches: number | null;
  width: number | null;
  height: number | null;
  reason: string | null;
};

const PRINT_SIZES = [
  { label: "8×10″", widthIn: 8, heightIn: 10 },
  { label: "5×7″", widthIn: 5, heightIn: 7 },
  { label: "4×6″", widthIn: 4, heightIn: 6 },
] as const;

export function printPackEligibility(
  width: number | null | undefined,
  height: number | null | undefined,
): PrintEligibility {
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (!w || !h) {
    return {
      eligible: false,
      maxSizeLabel: null,
      maxWidthInches: null,
      maxHeightInches: null,
      width: null,
      height: null,
      reason: "Portrait dimensions are not available yet.",
    };
  }

  for (const size of PRINT_SIZES) {
    const minW = Math.round(size.widthIn * PRINT_DPI);
    const minH = Math.round(size.heightIn * PRINT_DPI);
    const fitsPortrait = w >= minW && h >= minH;
    const fitsLandscape = w >= minH && h >= minW;
    if (fitsPortrait || fitsLandscape) {
      return {
        eligible: true,
        maxSizeLabel: size.label,
        maxWidthInches: size.widthIn,
        maxHeightInches: size.heightIn,
        width: w,
        height: h,
        reason: null,
      };
    }
  }

  return {
    eligible: false,
    maxSizeLabel: null,
    maxWidthInches: null,
    maxHeightInches: null,
    width: w,
    height: h,
    reason: `This portrait is ${w}×${h}px — too small for a standard print size at ${PRINT_DPI} DPI.`,
  };
}

export function upsellOfferByKey(key: string): PetUpsellDefinition | null {
  return PET_UPSELL_OFFERS[key as PetUpsellKey] ?? null;
}

export function formatUpsellPrice(cents: number, currency = "usd"): string {
  if (currency.toLowerCase() === "usd") {
    return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
  }
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export function sceneUpsellKeys(): PetUpsellKey[] {
  return PET_UPSELL_KEYS.filter((key) => PET_UPSELL_OFFERS[key].scope === "scene");
}
