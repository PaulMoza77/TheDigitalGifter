/**
 * Canonical customer-facing product facts for TheDigitalGifter.
 *
 * This is the only reusable source for brand, support, output types,
 * feature visibility, and verification status.
 *
 * Rules:
 * - Do not put Stripe prices, SKUs, or legal policy text here.
 * - Hidden flags must not be reintroduced in UI with softer wording.
 * - Anything not verified must not appear as a customer-facing fact.
 */

export const VerificationStatus = {
  VERIFIED: "VERIFIED",
  HIDDEN_UNTIL_VERIFIED: "HIDDEN_UNTIL_VERIFIED",
  REQUIRES_BUSINESS_INPUT: "REQUIRES_BUSINESS_INPUT",
  REQUIRES_END_TO_END_TEST: "REQUIRES_END_TO_END_TEST",
} as const;

export type VerificationStatusValue =
  (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const OUTPUT_STILL_IMAGE = "still_image" as const;

export type SupportedOutputType = typeof OUTPUT_STILL_IMAGE;

/** Customer-visible feature flags. False means do not show the claim or control. */
export type ProductTruthFlags = {
  videoGeneration: boolean;
  socialProofNumbers: boolean;
  reviews: boolean;
  testimonials: boolean;
  commercialUse: boolean;
  creditExpirationClaims: boolean;
  privacyDeletionClaims: boolean;
  generationTimeClaims: boolean;
  outputFormatClaims: boolean;
  printQualityClaims: boolean;
  freeBonusCredits: boolean;
  enterpriseWhiteLabel: boolean;
  support247: boolean;
  fakeUrgency: boolean;
  checkoutEnabled: boolean;
};

export type ProductTruthCopy = {
  supportResponseTime: string;
  supportResponseSentence: string;
  photoHandling: string;
  previewHeading: string;
  selectedPhotoLabel: string;
  selectedPhotoNote: string;
  checkoutUnavailable: string;
  aiGeneratedDisclosure: string;
  licenseSentence: string;
  digitalContentConsent: string;
};

export type ProductTruthStatus = {
  stillImage: VerificationStatusValue;
  video: VerificationStatusValue;
  socialProof: VerificationStatusValue;
  reviews: VerificationStatusValue;
  testimonials: VerificationStatusValue;
  commercialUse: VerificationStatusValue;
  creditExpiration: VerificationStatusValue;
  privacyDeletion: VerificationStatusValue;
  generationTime: VerificationStatusValue;
  outputFormat: VerificationStatusValue;
  printQuality: VerificationStatusValue;
  currency: VerificationStatusValue;
  supportResponseTime: VerificationStatusValue;
  brand: VerificationStatusValue;
  creditDelivery: VerificationStatusValue;
  postPaymentGeneration: VerificationStatusValue;
};

export type ProductTruth = {
  brandName: string;
  supportEmail: string;
  publicCurrency: "EUR";
  supportedOutputTypes: readonly SupportedOutputType[];
  flags: ProductTruthFlags;
  copy: ProductTruthCopy;
  status: ProductTruthStatus;
};

export const productTruth: ProductTruth = {
  brandName: "TheDigitalGifter",
  supportEmail: "support@thedigitalgifter.com",
  publicCurrency: "EUR",

  supportedOutputTypes: [OUTPUT_STILL_IMAGE],

  flags: {
    videoGeneration: false,
    socialProofNumbers: false,
    reviews: false,
    testimonials: false,
    commercialUse: false,
    creditExpirationClaims: false,
    privacyDeletionClaims: false,
    generationTimeClaims: false,
    outputFormatClaims: false,
    printQualityClaims: false,
    freeBonusCredits: false,
    enterpriseWhiteLabel: false,
    support247: false,
    fakeUrgency: false,
    checkoutEnabled: false,
  },

  copy: {
    supportResponseTime: "1–2 business days",
    supportResponseSentence: "Usually within 1–2 business days.",
    photoHandling:
      "Uploaded photos are stored privately and deleted after 24 hours. Generated results are stored privately for 30 days, then deleted. Access is via time-limited signed links.",
    previewHeading: "Your photo is ready for personalization",
    selectedPhotoLabel: "Selected photo",
    selectedPhotoNote:
      "This is your selected photo, not a generated result.",
    checkoutUnavailable:
      "Checkout is temporarily unavailable while payment and delivery are being verified.",
    aiGeneratedDisclosure: "AI-generated",
    licenseSentence:
      "For personal use until a commercial licence is published.",
    digitalContentConsent:
      "I want the digital image supplied immediately after payment and I understand that I lose the 14-day withdrawal right once generation starts.",
  },

  status: {
    brand: VerificationStatus.VERIFIED,
    supportResponseTime: VerificationStatus.VERIFIED,
    currency: VerificationStatus.VERIFIED,
    stillImage: VerificationStatus.REQUIRES_END_TO_END_TEST,
    video: VerificationStatus.HIDDEN_UNTIL_VERIFIED,
    socialProof: VerificationStatus.HIDDEN_UNTIL_VERIFIED,
    reviews: VerificationStatus.HIDDEN_UNTIL_VERIFIED,
    testimonials: VerificationStatus.HIDDEN_UNTIL_VERIFIED,
    commercialUse: VerificationStatus.HIDDEN_UNTIL_VERIFIED,
    creditExpiration: VerificationStatus.HIDDEN_UNTIL_VERIFIED,
    privacyDeletion: VerificationStatus.HIDDEN_UNTIL_VERIFIED,
    generationTime: VerificationStatus.HIDDEN_UNTIL_VERIFIED,
    outputFormat: VerificationStatus.HIDDEN_UNTIL_VERIFIED,
    printQuality: VerificationStatus.HIDDEN_UNTIL_VERIFIED,
    creditDelivery: VerificationStatus.REQUIRES_END_TO_END_TEST,
    postPaymentGeneration: VerificationStatus.REQUIRES_END_TO_END_TEST,
  },
};

export const isVideoGenerationEnabled = productTruth.flags.videoGeneration;
export const isSocialProofEnabled = productTruth.flags.socialProofNumbers;
export const isTestimonialsEnabled = productTruth.flags.testimonials;
export const isFakeUrgencyEnabled = productTruth.flags.fakeUrgency;
export const isCommercialUseEnabled = productTruth.flags.commercialUse;
export const isBonusCreditsVisible = productTruth.flags.freeBonusCredits;
export const isEnterpriseWhiteLabelEnabled =
  productTruth.flags.enterpriseWhiteLabel;
export const isPrintQualityClaimEnabled = productTruth.flags.printQualityClaims;
export const isCreditExpirationClaimEnabled =
  productTruth.flags.creditExpirationClaims;
export const isGenerationTimeClaimEnabled =
  productTruth.flags.generationTimeClaims;
export const isOutputFormatClaimEnabled = productTruth.flags.outputFormatClaims;
export const isPrivacyDeletionClaimEnabled =
  productTruth.flags.privacyDeletionClaims;
export const isSupport247Enabled = productTruth.flags.support247;
export const isReviewsEnabled = productTruth.flags.reviews;
export const isCheckoutEnabled = productTruth.flags.checkoutEnabled;
