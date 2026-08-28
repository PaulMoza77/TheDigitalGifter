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

/**
 * Authoritative identity instruction. The uploaded photo is the source of truth —
 * never invent a different animal from text alone.
 */
export const IDENTITY_LOCK =
  "Use the uploaded pet photo as the authoritative identity reference. Create the same individual pet in the requested scene. Preserve its exact species, breed appearance, coat color and markings, facial structure, muzzle length and width, ear shape and size, eye placement and color, fur length and texture, body proportions, and distinctive traits. Change only the environment, clothing/accessories, and pose needed for the scene. The final image must be immediately recognizable to the owner as the same pet. Do not swap breeds. Do not replace the animal with a generic dog or cat. Do not beautify beyond recognition. If cinematic drama conflicts with likeness, prioritize recognizable pet identity.";

export const IDENTITY_NEGATIVES =
  "Do not change breed. No German Shepherd, Labrador, husky, or mixed-breed features unless present in the reference. No different coat color or markings. No pointed oversized ears unless present in the reference. No elongated muzzle unless present in the reference. No short sleek coat when the reference has long, fluffy, dense, or mane-like fur. No human face, human head, human hands, or second animal. No unrelated human obstructing the pet. No malformed paws. No text, logos, brand marks, watermarks, or trademarks inside the artwork.";

export const F1_DRIVER_EDIT =
  "Create a photoreal, vibrant, cinematic transformation of the uploaded pet as a Formula 1 style racing driver. Change only the scene, styling, props, and lighting — never the pet's face, fur length, fur texture, breed, ear shape, muzzle shape, or body identity. Place the SAME pet alone in a realistic open-wheel race car cockpit on a bright sunlit racetrack or pit lane. Keep the pet's real head, face, mane/fur, ears, and front paws clearly visible and unmistakable. HARD RULE: no closed helmet, no full-face helmet, no helmet covering the ears or cheek ruff — leave the head bare or show only a tiny racing scarf/goggles resting above the forehead so every ear and the full neck mane stay exposed. Preserve coat length exactly: if the reference pet is fluffy or has a dense mane (for example a Chow Chow lion mane), keep that fluff and mane volume around the neck and cheeks — never replace long/dense fur with a short sleek coat, never crop the mane into a tight collar. Outfit may be racing-inspired with vivid color accents (red, electric blue, bright yellow, white) but must not copy real commercial logos, team names, sponsors, or brand marks (including Red Bull, Ferrari, Mercedes, Pirelli, or any readable logo text). Composition must look intentionally photographed with the pet as the sole focal point — not a dog head pasted onto a human body. Absolutely no human driver, passenger, helmeted person, or human hands behind or beside the pet. Avoid muddy brown/black dominance, dark dull grading, cartoonish looks, goofy costume vibes, clutter, and distorted anatomy.";

export const ROYAL_CAT_EDIT =
  "Create a photoreal, vibrant, cinematic transformation of the uploaded cat as a royal ruler. Change only the scene, styling, props, and lighting — never the cat's face, fur, markings, or body identity. Place the same cat wearing an ornate golden crown in a regal throne-room or museum-quality royal portrait setting with rich velvet, gold accents, and flattering portrait lighting. Preserve natural feline anatomy, fur color, markings, and eye color. The cat must remain unmistakably the same individual — no dog features, no extra limbs, no malformed paws, no second animal, no human face or hands. Bright, polished, luxurious royal portrait aesthetic. Avoid cartoonish looks, clutter, text overlays, watermarks, logos, and brand marks.";

export function resolvePreviewContext(body: Record<string, unknown>): {
  ok: true;
  ctx: PreviewFunnelContext;
  species: string;
} | {
  ok: false;
  errorCode: string;
  error: string;
} {
  const scene = String(body.scene || "").trim();
  const species =
    body.species === "cat" || body.species === "other" ? String(body.species) : "dog";

  // Explicit funnel_version wins. If omitted, royal-portrait implies V3 so a missing
  // funnel_version cannot silently fall into the V2 Formula-1 path (production bug class).
  let funnelVersion: PreviewFunnelVersion;
  if (body.funnel_version === "v3") {
    funnelVersion = "v3";
  } else if (body.funnel_version === "v2") {
    funnelVersion = "v2";
  } else if (scene === "royal-portrait") {
    funnelVersion = "v3";
  } else {
    funnelVersion = "v2";
  }

  if (funnelVersion === "v3") {
    if (species !== "cat") {
      return {
        ok: false,
        errorCode: "invalid_photo",
        error: "The V3 preview funnel only accepts cat photos.",
      };
    }
    if (scene === "formula-racer") {
      return {
        ok: false,
        errorCode: "invalid_funnel",
        error: "Cat V3 cannot use the Formula racing preview scene.",
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

  if (scene === "royal-portrait") {
    return {
      ok: false,
      errorCode: "invalid_funnel",
      error: "Royal portrait preview requires the Cat V3 funnel.",
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
    IDENTITY_NEGATIVES,
    "Change only background, clothing, props, and lighting. Never replace the pet.",
    sceneEdit,
    `Subject is a ${subject}. Match the uploaded ${subject}'s exact appearance from the reference photo.`,
    ctx.version === "v3"
      ? "Photoreal domestic cat only. Preserve feline facial structure, whiskers, and ear shape from the reference. No dogs. No text overlays. No watermarks. No logos. No extra animals. No humans."
      : "Photoreal. Single pet only. No logos, trademarks, team names, or copyrighted characters. No text overlays. No watermarks. No extra animals. No humans in frame.",
  ].join(" ");
}
