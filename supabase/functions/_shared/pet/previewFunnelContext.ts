/** Shared preview-funnel routing for V2 dog and V3 cat on pet-v2-preview. */

export type PreviewFunnelVersion = "v2" | "v3";

export type PreviewFunnelContext = {
  version: PreviewFunnelVersion;
  attemptsTable: string;
  claimRpc: string;
  updateRpc: string;
  sceneKey: string;
  rateLimitPrefix: string;
  liveKillEnv: string;
};

export const IDENTITY_LOCK =
  "Edit the reference photo only. Preserve the exact same pet identity: identical face shape, eyes, nose, muzzle, mouth, ears, fur color, fur texture, markings, age appearance, breed characteristics, body proportions, and general expression. Do not swap breeds or replace the pet with a different animal. Do not beautify beyond recognition. If cinematic drama conflicts with likeness, prioritize recognizable pet identity.";

export const F1_DRIVER_EDIT =
  "Create a photoreal, vibrant, cinematic transformation of the uploaded pet as a premium Formula 1 driver. Change only the scene, styling, props, and lighting — never the pet's face or body identity. Place the pet in or leaning out of a realistic Formula 1 race car cockpit with a visually exciting, high-end racing atmosphere (bright pit lane, paddock, or sunlit racetrack). The pet should wear a tailored racing suit with vivid motorsport-inspired color accents such as red, electric blue, bright yellow, and white; keep carbon black only as support, not the dominant look. Avoid muddy brown/black dominance and dark dull color grading. Prefer helmet with open visor or helmet pushed back so the face stays fully visible, expressive, and recognizable. Use brighter, more flattering lighting, stronger contrast, vivid highlights, clean subject separation, and tasteful depth of field. The final image should feel bold, polished, luxurious, energetic, and emotionally impressive — like a premium Formula 1 advertising hero image or cinematic motorsport editorial, not a dark muddy portrait. Avoid cartoonish looks, goofy costume vibes, clutter, and distorted anatomy.";

export const ROYAL_CAT_EDIT =
  "Create a photoreal, vibrant, cinematic transformation of the uploaded cat as a royal ruler. Change only the scene, styling, props, and lighting — never the cat's face or body identity. Place the cat wearing an ornate golden crown in a regal throne-room or museum-quality royal portrait setting with rich velvet, gold accents, and flattering portrait lighting. Preserve natural feline anatomy, fur color, markings, and eye color. The cat must remain unmistakably the same individual — no dog features, no extra limbs, no malformed paws. Bright, polished, luxurious royal portrait aesthetic. Avoid cartoonish looks, clutter, text overlays, watermarks, and extra animals.";

export function resolvePreviewContext(body: Record<string, unknown>): {
  ok: true;
  ctx: PreviewFunnelContext;
  species: string;
} | {
  ok: false;
  errorCode: string;
  error: string;
} {
  const funnelVersion = body.funnel_version === "v3" ? "v3" : "v2";
  const species =
    body.species === "cat" || body.species === "other" ? String(body.species) : "dog";

  if (funnelVersion === "v3") {
    if (species !== "cat") {
      return {
        ok: false,
        errorCode: "invalid_photo",
        error: "The V3 preview funnel only accepts cat photos.",
      };
    }
    return {
      ok: true,
      species: "cat",
      ctx: {
        version: "v3",
        attemptsTable: "pet_v3_preview_attempts",
        claimRpc: "claim_pet_v3_preview_attempt",
        updateRpc: "update_pet_v3_preview_attempt",
        sceneKey: "royal-portrait",
        rateLimitPrefix: "pet-v3",
        liveKillEnv: "PET_V3_PREVIEW_LIVE",
      },
    };
  }

  return {
    ok: true,
    species,
    ctx: {
      version: "v2",
      attemptsTable: "pet_v2_preview_attempts",
      claimRpc: "claim_pet_v2_preview_attempt",
      updateRpc: "update_pet_v2_preview_attempt",
      sceneKey: "formula-racer",
      rateLimitPrefix: "pet-v2",
      liveKillEnv: "PET_V2_PREVIEW_LIVE",
    },
  };
}

export function buildPreviewPrompt(ctx: PreviewFunnelContext, species: string): string {
  const sceneEdit = ctx.version === "v3" ? ROYAL_CAT_EDIT : F1_DRIVER_EDIT;
  const subject = ctx.version === "v3" ? "cat" : species === "other" ? "pet" : species;
  return [
    IDENTITY_LOCK,
    "Change only background, clothing, props, and lighting. Never replace the pet.",
    sceneEdit,
    `Subject is a ${subject}.`,
    ctx.version === "v3"
      ? "Photoreal domestic cat only. Preserve feline facial structure, whiskers, and ear shape. No dogs. No text overlays. No watermarks. No extra animals."
      : "Photoreal. Single pet only. No logos, trademarks, or copyrighted characters. No text overlays. No extra animals.",
  ].join(" ");
}
