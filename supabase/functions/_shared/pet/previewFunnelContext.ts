/** Shared preview-funnel routing for V2 dog and V3 cat on pet-v2-preview. */

/** Bump when identity prompts/gates change — live smoke verifies this after deploy. */
export const PET_PREVIEW_IDENTITY_BUILD = "pet-preview-identity-2026-08-29a";

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
  "CRITICAL IDENTITY LOCK: The uploaded pet photo is the only identity source. Keep the SAME individual animal so a customer instantly says “that is my pet.” Preserve breed, coat color/length/texture, markings, facial structure, muzzle length/width, ear shape/size, eye placement/color, neck ruff/mane volume, and body proportions. If the reference is a Chow Chow (dense lion mane, round head, small ears buried in fur, broad short muzzle, cinnamon coat), the result MUST stay that Chow Chow — not a shepherd, collie, husky, lab, retriever, or generic fluffy mix. Apply the requested scene around this pet; do not invent a different animal for the scene.";

export const IDENTITY_NEGATIVES =
  "FORBIDDEN identity drift: no German Shepherd, Belgian Malinois, husky, collie, Labrador, golden retriever, spitz mix, or generic stock-photo dog face unless that exact look is in the reference. No long pointed snout when the reference muzzle is short/broad. No large upright shepherd ears when the reference has small ears buried in fur. No dark dorsal snout stripe or sable shepherd mask unless in the reference. No short sleek coat when the reference has long/fluffy/dense/mane fur. No thinning a lion mane into a tight collar. No human face/head/hands or second animal. No text, logos, brand marks, watermarks, or trademarks.";

export const F1_DRIVER_EDIT =
  "SCENE REQUIREMENT (mandatory): photoreal Formula 1 style racing edit — the uploaded pet MUST be alone in a realistic open-wheel race car cockpit on a bright sunlit racetrack or pit lane. Do NOT output a plain studio portrait, indoor floor photo, or unchanged background. Keep the pet’s real head/face/mane identity from the reference (environment/wardrobe edit, not a breed redesign). BARE HEAD ONLY: absolutely no helmet of any kind (closed, open, half, novelty, or tiny) — no helmet resting nearby either; ears and full mane must be fully uncovered. Optional tiny racing scarf at the neck only. If the reference has a dense Chow Chow–style mane, show that full mane volume in the cockpit. Car body may use vivid colors but MUST be blank of emblems — no shields, crests, prancing horse, bulls, or any brand/team mark (including Ferrari, Red Bull, Mercedes, Pirelli) and no readable text. Pet is the sole focal point. No human driver, passenger, hands, or helmeted person. Avoid muddy grading, cartoons, goofy costumes, clutter, and distorted anatomy.";

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
  const sceneMandatory =
    ctx.version === "v3"
      ? "MANDATORY SCENE: royal throne-room portrait with crown — not a plain home photo."
      : "MANDATORY SCENE: open-wheel race car cockpit on a racetrack — not a plain studio or indoor floor portrait.";
  return [
    sceneEdit,
    IDENTITY_LOCK,
    IDENTITY_NEGATIVES,
    sceneMandatory,
    `Subject is a ${subject}. Match the uploaded ${subject}'s exact appearance from the reference photo.`,
    ctx.version === "v3"
      ? "Photoreal domestic cat only. Preserve feline facial structure, whiskers, and ear shape from the reference. No dogs. No text overlays. No watermarks. No logos. No extra animals. No humans."
      : "Photoreal. Single pet only. No logos, trademarks, team names, or copyrighted characters. No text overlays. No watermarks. No extra animals. No humans in frame.",
  ].join(" ");
}
