import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PET_FUNNEL_ALLOWED_EVENTS } from "../pet/funnelEventContract";
import { PET_DRAFT_STORAGE_KEY, PET_PRICE_CENTS, PET_PRICE_DISPLAY } from "../pet/types";
import { PET_FUNNEL_SESSION_KEY } from "../pet/funnelSession";
import { PET_V2_DRAFT_STORAGE_KEY, PET_V2_EVENTS, PET_V2_EVENT_PATH, PET_V2_PRODUCTION_PRICE_CENTS, PET_V2_SESSION_KEY, PET_V2_TEST_PRICE_CENTS } from "./types";
import { personalityChangesOutputEnoughToKeep, personalityRecommendation } from "./personality";
import { isHeicPhoto } from "./heic";
import { validateV2PhotoFile } from "./photo";
import {
  V2_PREVIEW_MODEL,
  V2_PREVIEW_PROVIDER,
  V2_PREVIEW_UNIT_COST_USD,
  costForPreviews,
  economicsAtConversion,
  worstCaseSessionCostUsd,
} from "./economics";
import { PET_FUNNEL_EVENT_PATH } from "../pet/funnelEventContract";
import { isPetV2EventName, petV2LandingPath, sanitizeV2Pathname } from "./analytics";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("pet funnel V2 isolation", () => {
  it("does not replace V1 routes or the $27 production price", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/pet/dog"');
    expect(app).toContain('path="/pet/cat"');
    expect(app).toContain('path="/pet/other"');
    expect(app).toContain("PetLandingRoute");
    expect(app).toContain('path="/pet/dog-v2"');
    expect(app).toContain('path="/pet/cat-v2"');
    expect(app).toContain('path="/pet/other-v2"');
    expect(app).toContain("PetV2Route");
    expect(PET_PRICE_CENTS).toBe(2700);
    expect(PET_PRICE_DISPLAY).toBe("$27");
    expect(PET_V2_PRODUCTION_PRICE_CENTS).toBe(2700);
    expect(PET_V2_TEST_PRICE_CENTS).toBe(1900);
    expect(readSrc("src/features/pet/PetLandingPage.tsx")).toContain("NameCapture");
    expect(readSrc("api/sitemap.xml.ts")).toContain('"/pet/dog"');
    expect(readSrc("api/sitemap.xml.ts")).not.toContain("/pet-v2");
    expect(readSrc("supabase/functions/_shared/pet/constants.ts")).toContain("PET_PRICE_CENTS = 2700");
  });

  it("keeps V1 and V2 storage, sessions, and ingest paths separate", () => {
    expect(PET_V2_SESSION_KEY).not.toBe(PET_FUNNEL_SESSION_KEY);
    expect(PET_V2_DRAFT_STORAGE_KEY).not.toBe(PET_DRAFT_STORAGE_KEY);
    expect(PET_V2_EVENT_PATH).not.toBe(PET_FUNNEL_EVENT_PATH);
    expect(PET_V2_EVENT_PATH).toBe("/api/pet-v2/funnel-event");
    expect(petV2LandingPath("dog")).toBe("/pet/dog-v2");
    expect(petV2LandingPath("cat")).toBe("/pet/cat-v2");
    expect(sanitizeV2Pathname("/pet/dog")).toBeNull();
    expect(sanitizeV2Pathname("/pet/dog-v2")).toBe("/pet/dog-v2");
  });

  it("cannot write V2 events into the V1 allow-list", () => {
    for (const name of PET_V2_EVENTS) {
      expect((PET_FUNNEL_ALLOWED_EVENTS as readonly string[]).includes(name)).toBe(false);
      expect(name.startsWith("v2_")).toBe(true);
      expect(isPetV2EventName(name)).toBe(true);
    }
    expect(isPetV2EventName("landing_view")).toBe(false);
    expect(readSrc("src/features/pet-v2/analytics.ts")).not.toContain("trackPetFunnelInternalEvent");
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).not.toContain("startPetCheckout");
    expect(readSrc("src/features/pet-v2/screens/OfferScreen.tsx")).toContain("No card was charged");
  });

  it("does not create a live Stripe checkout or change paid generation", () => {
    const previewApi = readSrc("api/pet-v2/preview.ts");
    expect(previewApi).not.toMatch(/stripe/i);
    expect(previewApi).toContain("black-forest-labs/flux-kontext-pro");
    expect(previewApi).not.toContain("pet-generate");
    expect(readSrc("src/features/pet-v2/screens/OfferScreen.tsx")).not.toContain("checkout.stripe.com");
    expect(readSrc("supabase/functions/pet-generate/index.ts")).toContain("createReplicatePrediction");
  });
});

describe("V2 free-preview economics", () => {
  it("uses the repository Kontext Pro tariff of $0.04", () => {
    expect(V2_PREVIEW_PROVIDER).toBe("replicate");
    expect(V2_PREVIEW_MODEL).toBe("black-forest-labs/flux-kontext-pro");
    expect(V2_PREVIEW_UNIT_COST_USD).toBe(0.04);
    expect(costForPreviews(1)).toBe(0.04);
    expect(costForPreviews(100)).toBe(4);
    expect(costForPreviews(1000)).toBe(40);
    expect(worstCaseSessionCostUsd()).toBe(0.08);
  });

  it("reports gross after AI at 1/2/5/10 percent conversion for 1000 previews", () => {
    const one = economicsAtConversion(1000, 1);
    expect(one.purchases).toBe(10);
    expect(one.generationCostUsd).toBe(40);
    expect(one.testRevenueUsd).toBe(190);
    expect(one.productionRevenueUsd).toBe(270);
    expect(one.grossAfterAiTestUsd).toBe(150);
    expect(one.grossAfterAiProductionUsd).toBe(230);

    const two = economicsAtConversion(1000, 2);
    expect(two.purchases).toBe(20);
    expect(two.grossAfterAiTestUsd).toBe(340);
    expect(two.grossAfterAiProductionUsd).toBe(500);

    const five = economicsAtConversion(1000, 5);
    expect(five.purchases).toBe(50);
    expect(five.grossAfterAiTestUsd).toBe(910);

    const ten = economicsAtConversion(1000, 10);
    expect(ten.purchases).toBe(100);
    expect(ten.grossAfterAiTestUsd).toBe(1860);
  });
});

describe("V2 HEIC and personality", () => {
  it("fails HEIC visibly instead of silently", () => {
    expect(isHeicPhoto({ name: "IMG_001.HEIC", type: "image/heic" })).toBe(true);
    expect(isHeicPhoto({ name: "dog.jpg", type: "image/jpeg" })).toBe(false);
    const heic = new File([new Uint8Array([1, 2, 3])], "IMG_001.HEIC", { type: "image/heic" });
    const result = validateV2PhotoFile(heic);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("heic_unsupported");
      expect(result.message).toMatch(/HEIC/i);
    }
  });

  it("recommends deleting personality from the purchase path", () => {
    expect(personalityChangesOutputEnoughToKeep()).toBe(false);
    expect(personalityRecommendation().keepInPurchasePath).toBe(false);
  });
});
