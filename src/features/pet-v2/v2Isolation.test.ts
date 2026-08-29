import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PET_FUNNEL_ALLOWED_EVENTS } from "../pet/funnelEventContract";
import { PET_SALE_PRICE_CENTS } from "../pet/flashSale";
import { v2PackOfferCopy } from "./V2PackOffer";
import { PET_V2_SALE_CYCLE_MS, PET_V2_SALE_EPOCH_MS, v2FlashSale } from "./v2FlashSale";
import { PET_DRAFT_STORAGE_KEY, PET_PRICE_CENTS, PET_PRICE_DISPLAY } from "../pet/types";
import { PET_FUNNEL_SESSION_KEY } from "../pet/funnelSession";
import { PET_V2_DRAFT_STORAGE_KEY, PET_V2_EVENTS, PET_V2_EVENT_PATH, PET_V2_PRICE_CENTS, PET_V2_PRODUCTION_PRICE_CENTS, PET_V2_SESSION_KEY, PET_V2_TEST_PRICE_CENTS } from "./types";
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
    expect(PET_V2_TEST_PRICE_CENTS).toBe(99);
    expect(PET_V2_PRICE_CENTS).toBe(99);
    expect(PET_SALE_PRICE_CENTS).toBe(1700);
    expect(readSrc("src/features/pet-v2/V2PackOffer.tsx")).not.toContain("petFlashSale");
    expect(readSrc("src/features/pet-v2/screens/LandingScreen.tsx")).toContain("V2StickyCta");
    expect(readSrc("src/features/pet-v2/screens/LandingScreen.tsx")).toContain("V2ClosingCta");
    expect(readSrc("src/features/pet-v2/screens/LandingScreen.tsx")).toContain("V2SaleLine");
    expect(readSrc("src/features/pet-v2/screens/LandingScreen.tsx")).toContain("V2HeroProof");
    expect(readSrc("src/features/pet-v2/screens/LandingScreen.tsx")).not.toContain("V2SaleBanner");
    expect(readSrc("src/features/pet-v2/screens/LandingScreen.tsx")).not.toContain("<V2PackOffer");
    expect(readSrc("src/features/pet-v2/V2Shell.tsx")).not.toContain(">Free preview<");
    expect(readSrc("src/components/SupportTicketWidget.tsx")).toContain("isSupportWidgetHidden");
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
    expect(readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts")).toContain('funnelVariant: "v2"');
    expect(readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts")).toContain("V2_ELEMENTS_UI_MODE");
    expect(readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts")).toContain('"elements"');
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).toContain("useV2EmbeddedCheckout");
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).toContain("buildV2PersonalizedTeaser");
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).not.toContain("requestV2Preview");
    expect(readSrc("src/features/pet/PetCheckoutPage.tsx")).toContain('uiMode: "custom"');
    const handler = readSrc("api/pet-v2-funnel-event.ts");
    const lib = readSrc("api/_lib/petV2.ts");
    expect(lib).not.toContain("src/features/pet-v2/types");
    expect(lib).toContain("missing_supabase_config");
    expect(handler).not.toContain("./_lib/");
    expect(handler).toContain("res.status(500)");
    expect(handler).not.toContain("status(202).json({ ok: true, duplicate: false })");
    expect(readSrc("vercel.json")).toContain("/api/pet-v2-funnel-event");
    expect(readSrc("vercel.json")).toContain("apple-developer-merchantid-domain-association");
  });

  it("uses existing mini clips and the other-pets animals already in the product", () => {
    const strip = readSrc("src/features/pet-v2/V2ExampleStrip.tsx");
    expect(strip).toContain("PET_DEMO_CLIP_IDS");
    expect(strip).toContain("PET_SCENES");
    expect(strip).toContain("All 12 secret lives");
    expect(strip).toContain("2 mini clips included");
    expect(strip).toContain("V2HeroProof");
    expect(strip).toContain("sceneHasMotionClip");
    expect(strip).toContain("AutoSceneClip");
    expect(strip).toContain("SceneImage");
    expect(strip).toContain("PET_OTHER_SUBJECTS");
    expect(readSrc("src/features/pet-v2/screens/LandingScreen.tsx")).toContain("V2HeroProof");
    expect(readSrc("src/features/pet-v2/screens/LandingScreen.tsx")).toContain("V2ExampleStrip");
    expect(readSrc("src/features/pet-v2/V2PackOffer.tsx")).toContain("12 secret lives and 2 mini clips");
    expect(readSrc("src/features/pet/components/SceneCard.tsx")).toContain("autoPlay");
    expect(readSrc("src/features/pet/components/SceneCard.tsx")).toContain("playsInline");
    expect(readSrc("src/features/pet/catalog.ts")).toContain('newspaper: "Guinea pig"');
    expect(readSrc("src/features/pet/catalog.ts")).toContain('"spa-bathtub": "Hedgehog"');
  });

  it("keeps pre-pay teaser local ($0) and charges V2 through pet-funnel at $0.99 after payment", () => {
    // Legacy preview edge remains for ops/smoke but must not be called pre-pay by the funnel page.
    const edgePreview = readSrc("supabase/functions/pet-v2-preview/index.ts");
    expect(edgePreview).toContain("black-forest-labs/flux-kontext-pro");
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).toContain("buildV2PersonalizedTeaser");
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).not.toContain("requestV2Preview");
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).toContain("teaserLockRef");
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).toContain('generationMode === "teaser"');
    expect(readSrc("src/features/pet-v2/teaser.ts")).toContain("pixelateInPlace");
    expect(readSrc("src/features/pet-v2/teaser.ts")).toContain("boxBlurInPlace");
    expect(readSrc("supabase/functions/pet-generate/index.ts")).toContain("createReplicatePrediction");
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain("applyV2SaleAmount");
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain("funnel_variant");
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain("PROVIDER_UNAVAILABLE");
    expect(readSrc("supabase/functions/_shared/pet/constants.ts")).toContain("PET_V2_PRICE_CENTS = 99");
    expect(readSrc("supabase/functions/_shared/pet/flashSale.ts")).toContain("applyV2SaleAmount");
    expect(readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts")).toContain('funnelVariant: "v2"');
  });

  it("always shows $0.99 from $27 with a rolling 24h timer", () => {
    const during = v2PackOfferCopy(PET_V2_SALE_EPOCH_MS + 1000);
    expect(during.saleActive).toBe(true);
    expect(during.amountCents).toBe(PET_V2_PRICE_CENTS);
    expect(during.priceDisplay).toBe("$0.99");
    expect(during.compareAtDisplay).toBe("$27");
    expect(Date.parse(during.expiresAt!)).toBeGreaterThan(PET_V2_SALE_EPOCH_MS);

    const nextCycle = v2FlashSale(PET_V2_SALE_EPOCH_MS + PET_V2_SALE_CYCLE_MS + 5000);
    expect(nextCycle.saleActive).toBe(true);
    expect(nextCycle.amountCents).toBe(99);
    expect(nextCycle.priceDisplay).toBe("$0.99");
    expect(nextCycle.compareAtDisplay).toBe("$27");
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
    expect(one.testRevenueUsd).toBe(9.9);
    expect(one.productionRevenueUsd).toBe(270);
    expect(one.grossAfterAiTestUsd).toBe(-30.1);
    expect(one.grossAfterAiProductionUsd).toBe(230);

    const two = economicsAtConversion(1000, 2);
    expect(two.purchases).toBe(20);
    expect(two.grossAfterAiTestUsd).toBe(-20.2);
    expect(two.grossAfterAiProductionUsd).toBe(500);

    const five = economicsAtConversion(1000, 5);
    expect(five.purchases).toBe(50);
    expect(five.grossAfterAiTestUsd).toBe(9.5);

    const ten = economicsAtConversion(1000, 10);
    expect(ten.purchases).toBe(100);
    expect(ten.grossAfterAiTestUsd).toBe(59);
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
