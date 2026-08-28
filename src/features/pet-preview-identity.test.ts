import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPreviewPrompt,
  F1_DRIVER_EDIT,
  IDENTITY_LOCK,
  IDENTITY_NEGATIVES,
  PET_PREVIEW_IDENTITY_BUILD,
  resolvePreviewContext,
  ROYAL_CAT_EDIT,
} from "../../supabase/functions/_shared/pet/previewFunnelContext.ts";
import { decodePreviewDataUrl } from "../../supabase/functions/_shared/pet/previewImage.ts";
import {
  decideSpeciesOutcome,
  speciesRejectMessage,
} from "../../supabase/functions/_shared/pet/speciesValidate.ts";
import { PET_V2_DRAFT_STORAGE_KEY, PET_V2_SESSION_KEY, PET_V2_UPLOAD_MAX_EDGE } from "./pet-v2/types";
import { PET_V3_DRAFT_STORAGE_KEY, PET_V3_SESSION_KEY } from "./pet-v3/types";
import { PET_V3_FUNNEL_CONFIG as V3_CONFIG } from "./pet-v3/config";
import { clearPreviewOnPhotoChange, resolveGenerateAttempt } from "./pet-v2/previewFlow";
import { previewErrorMessage } from "./pet-v2/previewErrors";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

/** Minimal valid 1x1 JPEG */
const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";

describe("pet preview identity + funnel integrity", () => {
  it("Dog V2 copy never uses Cat V3 secret-life wording", () => {
    const preview = readSrc("src/features/pet-v2/screens/PreviewScreen.tsx");
    expect(preview).toContain("Your {petLabel}’s secret life starts here");
    expect(preview).not.toContain("Your cat’s secret life starts here");
    expect(V3_CONFIG.copy.previewSubhead).toContain("Your cat’s secret life starts here");
    expect(PET_V2_DRAFT_STORAGE_KEY).not.toBe(PET_V3_DRAFT_STORAGE_KEY);
    expect(PET_V2_SESSION_KEY).not.toBe(PET_V3_SESSION_KEY);
    expect(readSrc("src/features/pet-v2/screens/PhotoScreen.tsx")).toContain("speciesConfirmLabel");
    expect(readSrc("src/features/pet-v3/screens/PhotoScreen.tsx")).toContain('speciesConfirmLabel("cat")');
  });

  it("Cat V3 copy never uses Dog V2 F1 wording", () => {
    expect(V3_CONFIG.copy.previewSubhead).not.toMatch(/F1|Formula/i);
    expect(V3_CONFIG.previewScene).toBe("royal-portrait");
    expect(readSrc("src/features/pet-v3/screens/PreviewScreen.tsx")).not.toContain("F1 driver");
  });

  it("Cat funnel rejects a clearly detected dog before generation", () => {
    const result = decideSpeciesOutcome("cat", "dog", 0.96);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("wrong_species");
      expect(result.error).toBe(speciesRejectMessage("cat"));
    }
  });

  it("Dog funnel rejects a clearly detected cat before generation", () => {
    const result = decideSpeciesOutcome("dog", "cat", 0.91);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("wrong_species");
      expect(result.error).toBe(speciesRejectMessage("dog"));
    }
  });

  it("does not auto-reject ambiguous species classifications", () => {
    const ambiguous = decideSpeciesOutcome("cat", "dog", 0.4);
    expect(ambiguous.ok).toBe(true);
    const unclearLow = decideSpeciesOutcome("dog", "unclear", 0.2);
    expect(unclearLow.ok).toBe(true);
  });

  it("asks for a clearer image when the photo is clearly not a single pet", () => {
    const unclear = decideSpeciesOutcome("dog", "unclear", 0.9);
    expect(unclear.ok).toBe(false);
    if (!unclear.ok) {
      expect(unclear.errorCode).toBe("unclear_species");
      expect(unclear.action).toBe("ask_clearer");
    }
  });

  it("fails safely when the reference image is missing or unreadable", () => {
    expect(decodePreviewDataUrl("").ok).toBe(false);
    expect(decodePreviewDataUrl("data:image/jpeg;base64,@@@").ok).toBe(false);
    expect(decodePreviewDataUrl("data:image/heic;base64,AAAA").ok).toBe(false);
    const ok = decodePreviewDataUrl(TINY_JPEG);
    // Tiny JPEG may fail MIN_BYTES — either decode magic or reject as too small is fine.
    if (ok.ok) {
      expect(ok.image.magic).toBe("jpeg");
    } else {
      expect(ok.errorCode).toBe("invalid_photo");
    }
  });

  it("never builds a text-only Replicate payload in the preview edge function", () => {
    const preview = readSrc("supabase/functions/pet-v2-preview/index.ts");
    expect(preview).toContain("input_image: imageDataUrl");
    expect(preview).toContain("never create a text-only prediction");
    expect(preview).toContain("hasInputImage");
    expect(preview).not.toMatch(/text-to-image|txt2img|fallbackToText/i);
    expect(preview).toContain("validatePetSpecies");
    expect(preview).toContain("decodePreviewDataUrl");
    const species = readSrc("supabase/functions/_shared/pet/speciesValidate.ts");
    expect(species).toContain("classifyWithReplicate");
    expect(species).toContain("lucataco/moondream2");
  });

  it("keeps preview attempts tied to the current upload/session", () => {
    const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const uploadA = "upload-a";
    const uploadB = "upload-b";
    const attemptA = `preview:${sessionId}:${uploadA}`;
    const next = resolveGenerateAttempt({
      sessionId,
      uploadId: uploadB,
      previewAttemptId: attemptA,
      regenerate: false,
      retryAfterFailure: false,
    });
    expect(next.attemptId).toContain(uploadB);
    expect(next.attemptId).not.toBe(attemptA);

    const cleared = clearPreviewOnPhotoChange({
      uploadId: uploadB,
      photoPreviewDataUrl: "data:image/jpeg;base64,new",
    });
    expect(cleared.generatedPreviewDataUrl).toBeNull();
    expect(cleared.previewAttemptId).toBeNull();
  });

  it("surface wrong-species errors with the product copy", () => {
    expect(
      previewErrorMessage({
        errorCode: "wrong_species",
        error: speciesRejectMessage("cat"),
      }),
    ).toBe("This experience is designed for cats. Please upload a clear photo of your cat.");
  });

  it("uses stronger identity prompts and bans humans/logos in F1", () => {
    const v2 = resolvePreviewContext({ species: "dog", scene: "formula-racer" });
    expect(v2.ok).toBe(true);
    if (v2.ok) {
      const prompt = buildPreviewPrompt(v2.ctx, "dog");
      expect(prompt).toContain(IDENTITY_LOCK.slice(0, 40));
      expect(prompt).toContain(IDENTITY_NEGATIVES.slice(0, 20));
      expect(prompt).toContain(F1_DRIVER_EDIT.slice(0, 40));
      expect(prompt).toMatch(/no human driver/i);
      expect(prompt).toMatch(/logos/i);
      expect(prompt).toContain("authoritative identity reference");
      expect(prompt).toMatch(/no closed helmet|HARD RULE/i);
      expect(prompt).toMatch(/dense mane|fluff|Chow Chow/i);
      expect(prompt).toMatch(/short sleek coat/i);
    }
    const v3 = resolvePreviewContext({ funnel_version: "v3", species: "cat", scene: "royal-portrait" });
    expect(v3.ok).toBe(true);
    if (v3.ok) {
      expect(buildPreviewPrompt(v3.ctx, "cat")).toContain(ROYAL_CAT_EDIT.slice(0, 40));
      expect(buildPreviewPrompt(v3.ctx, "cat")).not.toContain("Formula 1");
    }
  });

  it("does not let a missing funnel_version send royal-portrait into V2 F1", () => {
    const recovered = resolvePreviewContext({ species: "cat", scene: "royal-portrait" });
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      expect(recovered.ctx.version).toBe("v3");
      expect(recovered.ctx.sceneKey).toBe("royal-portrait");
    }
    const mismatch = resolvePreviewContext({
      funnel_version: "v3",
      species: "cat",
      scene: "formula-racer",
    });
    expect(mismatch.ok).toBe(false);
  });

  it("preserves higher-quality normalized source images for identity", () => {
    expect(PET_V2_UPLOAD_MAX_EDGE).toBeGreaterThanOrEqual(2048);
    expect(readSrc("src/features/pet-v2/photo.ts")).toContain("0.95");
    expect(readSrc("src/features/pet-v2/photo.ts")).toContain("imageSmoothingQuality");
  });

  it("sends explicit V2 funnel_version from the Dog/Cat V2 client", () => {
    expect(readSrc("src/features/pet-v2/previewClient.ts")).toContain('funnel_version: "v2"');
  });

  it("requires likeness confirmation before unlock on Dog V2 and Cat V3 previews", () => {
    expect(readSrc("src/features/pet-v2/screens/PreviewScreen.tsx")).toContain("identityConfirmLabel");
    expect(readSrc("src/features/pet-v3/screens/PreviewScreen.tsx")).toContain('identityConfirmLabel("cat")');
    expect(readSrc("src/features/pet-v2/screens/PreviewScreen.tsx")).toContain("canUnlockWithIdentityConfirm");
    expect(readSrc("src/features/pet-v3/screens/PreviewScreen.tsx")).toContain("canUnlockWithIdentityConfirm");
    expect(readSrc("src/features/pet-v2/screens/PreviewScreen.tsx")).toContain("sourceUrl");
    expect(readSrc("src/features/pet-v3/screens/PreviewScreen.tsx")).toContain("sourceUrl");
  });

  it("keeps production analytics event names unchanged", () => {
    expect(readSrc("src/features/pet-v2/types.ts")).toContain('"v2_purchase"');
    expect(readSrc("src/features/pet-v3/types.ts")).toContain('"v3_purchase"');
    expect(readSrc("src/features/pet-v3/v3CanonicalPurchase.ts")).toContain("v3_purchase");
  });

  it("isolates Dog/Cat/Other V2 tab drafts so photos do not cross species", () => {
    const page = readSrc("src/features/pet-v2/PetV2FunnelPage.tsx");
    expect(page).toContain("draftAfterSpeciesRouteChange");
    expect(page).toContain("setV2PhotoFile(null)");
    expect(readSrc("src/features/pet-v2/speciesRouteIsolation.ts")).toContain(
      "clearPreviewOnPhotoChange",
    );
  });

  it("exposes an identityBuild marker for post-deploy smoke verification", () => {
    expect(PET_PREVIEW_IDENTITY_BUILD).toMatch(/^pet-preview-identity-/);
    const edge = readSrc("supabase/functions/pet-v2-preview/index.ts");
    expect(edge).toContain("PET_PREVIEW_IDENTITY_BUILD");
    expect(edge).toContain('req.method === "GET"');
    expect(edge).toContain("identityBuild: PET_PREVIEW_IDENTITY_BUILD");
  });

  it("retries Replicate creates and can fall back to OpenAI image edit on rate limits", () => {
    const edge = readSrc("supabase/functions/pet-v2-preview/index.ts");
    expect(edge).toContain("createReplicatePrediction");
    expect(edge).toContain("provider_create_retry");
    expect(edge).toContain("openai_fallback_start");
    expect(edge).toContain("runOpenAiIdentityEdit");
    expect(edge).toContain("images/edits");
    expect(edge).toContain('url.startsWith("data:image/")');
  });
});
