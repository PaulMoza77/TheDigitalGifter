/**
 * Typed funnel configuration shared across preview-funnel versions.
 * V2 dog and V3 cat each supply a definition; V2 behavior stays on its defaults.
 */

export type PreviewFunnelVersion = "v2" | "v3";

export type PreviewFunnelSpecies = "dog" | "cat" | "other";

export type PreviewFunnelStep =
  | "landing"
  | "photo"
  | "generating"
  | "preview"
  | "offer";

export type PreviewFunnelCopy = {
  pageTitle: string;
  pageDescription: string;
  landingEyebrow: string;
  landingHeadline: string;
  landingSubhead: string;
  landingCta: string;
  landingFooter: string;
  closingHeadline: string;
  closingSubhead: (priceDisplay: string) => string;
  photoHeadline: string;
  photoSubhead: string;
  generateCta: string;
  generatingHeadline: string;
  generatingSubhead: string;
  generatingStatus: string[];
  previewEyebrow: string;
  previewHeadline: (petName?: string) => string;
  previewSubhead: string;
  previewImageAlt: string;
  mockPreviewNote: string;
  unlockCta: (priceDisplay: string) => string;
  offerHeadline: string;
  offerSubhead: (headline: string) => string;
  packHeadline: (priceDisplay: string, compareAtDisplay: string, saleActive: boolean) => string;
};

export type PreviewFunnelDefinition = {
  version: PreviewFunnelVersion;
  species: PreviewFunnelSpecies;
  routePath: string;
  previewScene: string;
  funnelVariant: string;
  funnelVariantAnalytics: string;
  priceCents: number;
  priceDisplay: string;
  compareAtDisplay: string;
  copy: PreviewFunnelCopy;
};
