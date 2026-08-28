/** Shared preview-funnel routing for V2 dog and V3 cat on pet-v2-preview. */

/** Bump when identity prompts/gates change — live smoke verifies this after deploy. */
export const PET_PREVIEW_IDENTITY_BUILD = "pet-preview-identity-2026-08-28e";

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
  "CRITICAL IDENTITY LOCK: The uploaded pet photo is the only identity source. Output the SAME individual animal — a customer must instantly say “that is my pet.” Copy breed, species, age look, coat color, coat length, coat texture, markings, facial structure, skull shape, muzzle length/width, nose shape, ear shape/size/placement, eye shape/color/spacing, brow, cheek fur, neck ruff/mane volume, body proportions, and paw fluff from the reference. If the reference is a Chow Chow (or any dense-maned fluffy breed), the result MUST remain that Chow Chow: round lion-like head, very dense voluminous mane around neck and cheeks, small triangular ears nearly buried in mane fur, broad short muzzle, deep-set dark eyes, cinnamon/reddish coat matching the reference — not a shepherd, collie, husky, lab, retriever, or generic fluffy mix. Change ONLY environment, wardrobe/accessories, and pose required by the scene. Never invent a different breed from the scene prompt. If likeness conflicts with cinematic drama, keep likeness.";

export const IDENTITY_NEGATIVES =
  "FORBIDDEN identity drift: no German Shepherd, Belgian Malinois, husky, collie, Labrador, golden retriever, spitz mix, or generic “dog stock photo” face unless that exact look is in the reference. No long pointed snout when the reference muzzle is short/broad. No large upright bat/shepherd ears when the reference has small ears buried in fur. No dark dorsal snout stripe, black eye mask, or sable shepherd markings unless present in the reference. No short sleek coat when the reference has long, fluffy, dense, or mane-like fur. No thinning or cropping a lion mane into a tight collar. No human face, human head, human hands, or second animal. No text, logos, brand marks, watermarks, or trademarks inside the artwork.";

export const F1_DRIVER_EDIT =
  "Photoreal cinematic edit of the UPLOADED pet as a Formula 1 style racing driver. Keep the pet’s real head/face/mane identity pixel-faithful to the reference — this is an environment/wardrobe edit, not a breed redesign. Place the SAME pet alone in a realistic open-wheel race car cockpit on a bright sunlit racetrack or pit lane. Head bare (no helmet): HARD BAN closed helmet, full-face helmet, helmet covering ears or cheek ruff; optional tiny goggles/scarf only above the forehead so the full mane stays visible. If the reference has a dense Chow Chow–style mane, show that full mane volume around neck and cheeks in the cockpit — never swap to short fur. Outfit may use vivid racing colors without real commercial logos/team marks (no Red Bull, Ferrari, Mercedes, Pirelli, or readable brand text). Pet is the sole focal point. No human driver, passenger, hands, or helmeted person. Avoid muddy grading, cartoons, goofy costumes, clutter, and distorted anatomy.";

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
