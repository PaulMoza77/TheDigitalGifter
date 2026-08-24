/**
 * V1 personality is a required create-step. Prompts only append a mood sentence
 * while IDENTITY_LOCK forbids changing the pet's expression. Scenes already
 * define wardrobe, setting, and lighting. Personality is not worth a required
 * step on the purchase path.
 */
export const PET_V2_PERSONALITY_VERDICT = "omit_from_purchase_path" as const;

export function personalityChangesOutputEnoughToKeep(): false {
  return false;
}

export function personalityRecommendation(): {
  keepInPurchasePath: false;
  reason: string;
} {
  return {
    keepInPurchasePath: false,
    reason:
      "V1 personalityTone() only changes scene-mood adjectives. IDENTITY_LOCK requires the pet's expression to stay true to the photo, and each scene already specifies the edit. Personality does not justify another required step before payment.",
  };
}
