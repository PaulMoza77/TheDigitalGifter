import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { clearPetDraft, createEmptyPetDraft, loadPetDraft, savePetDraft } from "./storage";
import { getPetFunnelSessionId } from "./funnelSession";
import { logicalIdempotencyKey, sequentialConversionPct, validateFunnelIngestPayload } from "./funnelEventContract";
import { isHeicLikePhoto, normalizePetPhotoFile } from "./photoNormalize";
import { validatePetPhotoFile } from "./validation";
import { PET_FUNNEL_INTERNAL_EVENTS } from "./funnelDashboard";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

function installMemoryStorage() {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage(local),
      sessionStorage: storage(session),
    },
  });
}

describe("V1 name → photo UX and diagnostics", () => {
  beforeEach(() => {
    installMemoryStorage();
    clearPetDraft();
  });

  it("persists pet name and the same funnel session id through navigation/refresh", () => {
    const sessionA = getPetFunnelSessionId();
    savePetDraft({ ...createEmptyPetDraft(), petName: "Milo", species: "dog" });
    expect(loadPetDraft().petName).toBe("Milo");
    expect(getPetFunnelSessionId()).toBe(sessionA);
    // Simulate remount / refresh: draft reloads from localStorage, session from storage.
    expect(loadPetDraft().petName).toBe("Milo");
    expect(getPetFunnelSessionId()).toBe(sessionA);
  });

  it("photo step renders personalized upload copy and a lightweight wow example", () => {
    const create = readSrc("src/features/pet/PetCreatePage.tsx");
    expect(create).toContain("Great — now upload a photo of");
    expect(create).toContain("face is easy to");
    expect(create).toContain("Upload");
    expect(create).toContain("Takes a few seconds · Your photo stays private");
    expect(create).toContain("One photo. Incredible secret lives.");
    expect(create).toContain("formula-racer");
    expect(create).not.toContain("v2_");
    expect(create).not.toContain("generatePreview");
  });

  it("fires photo_step_viewed once per session and keeps canonical V1 events", () => {
    expect(PET_FUNNEL_INTERNAL_EVENTS).toContain("photo_step_viewed");
    expect(logicalIdempotencyKey({ sessionId: "11111111-1111-4111-8111-111111111111", eventName: "photo_step_viewed" })).toBe(
      "11111111-1111-4111-8111-111111111111:photo_step_viewed",
    );
    const row = validateFunnelIngestPayload(
      {
        event_name: "photo_step_viewed",
        funnel_session_id: "11111111-1111-4111-8111-111111111111",
        species: "dog",
      },
      120,
    );
    expect(row.eventName).toBe("photo_step_viewed");
    expect(readSrc("src/features/pet/PetCreatePage.tsx")).toContain('eventName: "photo_step_viewed"');
    expect(readSrc("src/features/pet-v2/analytics.ts")).not.toContain("photo_step_viewed");
    expect(readSrc("src/features/pet-v2/types.ts")).not.toContain("photo_step_viewed");
  });

  it("accepts valid JPEG and visibly rejects invalid files including HEIC without silent failure", () => {
    const jpeg = new File([new Uint8Array([1, 2, 3])], "milo.jpg", { type: "image/jpeg" });
    expect(validatePetPhotoFile(jpeg).ok).toBe(true);

    const empty = new File([], "empty.jpg", { type: "image/jpeg" });
    expect(validatePetPhotoFile(empty).ok).toBe(false);

    const heic = new File([new Uint8Array([1, 2, 3])], "milo.heic", { type: "image/heic" });
    expect(isHeicLikePhoto(heic)).toBe(true);
    expect(validatePetPhotoFile(heic).ok).toBe(false);
    if (!validatePetPhotoFile(heic).ok) {
      expect(validatePetPhotoFile(heic).message).toMatch(/HEIC|JPEG/i);
    }
  });

  it("normalizePetPhotoFile passes through JPEG unchanged", async () => {
    const jpeg = new File([new Uint8Array([9, 8, 7])], "milo.jpg", { type: "image/jpeg" });
    const result = await normalizePetPhotoFile(jpeg);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file).toBe(jpeg);
    }
  });

  it("checkout does not count order review without a valid photo", () => {
    const checkout = readSrc("src/features/pet/PetCheckoutPage.tsx");
    expect(checkout).toMatch(/if \(!nameOk \|\| !photoOk\)/);
    expect(checkout).toContain("goToCreate");
    expect(checkout.indexOf("goToCreate")).toBeLessThan(checkout.indexOf("PetOrderReviewViewed"));
  });

  it("sequential conversion cannot inflate above 100% from out-of-cohort reviews", () => {
    expect(sequentialConversionPct(4, 3)).toBe(100);
    expect(sequentialConversionPct(2, 7)).toBeCloseTo(28.571, 2);
    expect(sequentialConversionPct(0, 7)).toBe(0);
  });

  it("landing bottom CTA validates the pet name before navigation", () => {
    const landing = readSrc("src/features/pet/PetLandingPage.tsx");
    expect(landing).toContain("validatePetName(draft.petName)");
    expect(landing).toContain("validatePetName(name)");
  });
});
