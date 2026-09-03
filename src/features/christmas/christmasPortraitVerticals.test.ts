import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertStyleAllowed,
  canGenerateChristmasPhoto,
  rejectClientPrompt,
} from "./generationGuards";
import {
  christmasPreviewUsesReplicate,
} from "./photoPreview";
import {
  resolveProductStyle,
  stylesForProductKey,
  CHRISTMAS_FAMILY_STYLES,
  CHRISTMAS_COUPLE_STYLES,
  CHRISTMAS_PET_STYLES,
} from "./portraitStyles";
import {
  CHRISTMAS_PORTRAIT_VERTICALS,
  verticalFromPathname,
  isPortraitCommerceProduct,
} from "./portraitVerticals";
import { CHRISTMAS_CATALOG_SEED, ctaStateForProduct, resolvePurchasableOffer } from "./catalog";
import { shellForPath } from "./routes";
import { enabledChristmasStyles } from "./styles";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("christmas portrait vertical config", () => {
  it("maps each route to the correct product config", () => {
    expect(verticalFromPathname("/christmas/photo-generator")?.productKey).toBe("christmas_photo");
    expect(verticalFromPathname("/christmas/family")?.productKey).toBe("christmas_family");
    expect(verticalFromPathname("/christmas/couples")?.productKey).toBe("christmas_couple");
    expect(verticalFromPathname("/christmas/pets")?.productKey).toBe("christmas_pet");
    expect(verticalFromPathname("/christmas/dogs")?.productKey).toBe("christmas_pet");
    expect(verticalFromPathname("/christmas/cats")?.productKey).toBe("christmas_pet");
    expect(verticalFromPathname("/christmas/dogs")?.expectedSpecies).toBe("dog");
    expect(verticalFromPathname("/christmas/cats")?.expectedSpecies).toBe("cat");
  });

  it("dogs/cats share christmas_pet commerce product with species metadata", () => {
    expect(CHRISTMAS_PORTRAIT_VERTICALS.dogs.productKey).toBe("christmas_pet");
    expect(CHRISTMAS_PORTRAIT_VERTICALS.cats.productKey).toBe("christmas_pet");
    expect(isPortraitCommerceProduct("christmas_pet")).toBe(true);
    expect(isPortraitCommerceProduct("christmas_dog")).toBe(false);
  });

  it("rejects invalid product keys for commerce portrait set", () => {
    expect(isPortraitCommerceProduct("not_a_product")).toBe(false);
  });

  it("family/couples/pets are not shells anymore", () => {
    expect(shellForPath("/christmas/family")).toBeNull();
    expect(shellForPath("/christmas/couples")).toBeNull();
    expect(shellForPath("/christmas/pets")).toBeNull();
    expect(shellForPath("/christmas/dogs")).toBeNull();
    expect(shellForPath("/christmas/cats")).toBeNull();
    expect(shellForPath("/christmas/santa-video")).toBeNull();
    expect(shellForPath("/christmas/tree")).toBeNull();
    expect(shellForPath("/christmas/advent")).toBeNull();
    expect(shellForPath("/christmas/wishlist")).toBeNull();
    expect(shellForPath("/christmas/gift-finder")).toBeNull();
    expect(shellForPath("/christmas/kids")?.status).toBe("coming_soon");
  });
});

describe("christmas portrait style registry", () => {
  it("resolves allowed styles per product", () => {
    expect(resolveProductStyle("christmas_family", "classic_family_christmas")?.promptTemplate.length).toBeGreaterThan(40);
    expect(resolveProductStyle("christmas_couple", "romantic_snowfall")).toBeTruthy();
    expect(resolveProductStyle("christmas_pet", "santa_pet")).toBeTruthy();
    expect(enabledChristmasStyles(CHRISTMAS_FAMILY_STYLES).length).toBeGreaterThanOrEqual(6);
    expect(enabledChristmasStyles(CHRISTMAS_COUPLE_STYLES).length).toBeGreaterThanOrEqual(6);
    expect(enabledChristmasStyles(CHRISTMAS_PET_STYLES).length).toBeGreaterThanOrEqual(6);
  });

  it("rejects cross-product and unknown styles", () => {
    expect(resolveProductStyle("christmas_family", "classic_christmas")).toBeNull();
    expect(resolveProductStyle("christmas_photo", "santa_pet")).toBeNull();
    expect(assertStyleAllowed("classic_family_christmas", undefined, "christmas_family").ok).toBe(true);
    expect(assertStyleAllowed("classic_family_christmas", undefined, "christmas_photo").ok).toBe(false);
    expect(assertStyleAllowed("nope", undefined, "christmas_pet").ok).toBe(false);
  });

  it("rejects arbitrary client prompts", () => {
    expect(rejectClientPrompt(undefined).ok).toBe(true);
    expect(rejectClientPrompt("hack the prompt").ok).toBe(false);
  });

  it("deno registry mirrors client product style keys", () => {
    const deno = readSrc("supabase/functions/_shared/christmas/portraitPromptRegistry.ts");
    for (const key of stylesForProductKey("christmas_family").map((s) => s.styleKey)) {
      expect(deno).toContain(`"styleKey": "${key}"`);
    }
    expect(deno).toContain("buildChristmasPortraitPrompt");
    expect(deno).toContain("never trusted");
  });
});

describe("christmas portrait preview contract", () => {
  it("shared funnel uses original blur only; zero Replicate pre-payment", () => {
    expect(christmasPreviewUsesReplicate()).toBe(false);
    const page = readSrc("src/features/christmas/ChristmasPortraitFunnelPage.tsx");
    expect(page).toContain("createBlurredOriginalPreview");
    expect(page).not.toContain("pet-v2-preview");
    expect(page).not.toContain("replicate.com");
    expect(readSrc("src/features/christmas/photoPreview.ts")).not.toContain("replicate.com");
  });
});

describe("christmas portrait packages remain non-purchasable", () => {
  for (const productKey of ["christmas_photo", "christmas_family", "christmas_couple", "christmas_pet"]) {
    it(`${productKey} seed package is not purchasable`, () => {
      const result = resolvePurchasableOffer({
        catalog: CHRISTMAS_CATALOG_SEED,
        productKey,
        packageKey: "single",
        clientAmountCents: 1999,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("not_purchasable");
      expect(ctaStateForProduct(CHRISTMAS_CATALOG_SEED.find((p) => p.productKey === productKey)!)).toBe("open");
    });
  }
});

describe("christmas portrait payment gates", () => {
  it("unpaid cannot generate", () => {
    expect(canGenerateChristmasPhoto({ paymentStatus: "pending" }).ok).toBe(false);
    expect(canGenerateChristmasPhoto({ paymentStatus: "paid" }).ok).toBe(true);
  });
});

describe("christmas portrait wiring", () => {
  it("App routes five verticals to shared funnel", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain("ChristmasPortraitFunnelPage");
    for (const path of [
      "/christmas/photo-generator",
      "/christmas/family",
      "/christmas/couples",
      "/christmas/pets",
      "/christmas/dogs",
      "/christmas/cats",
    ]) {
      expect(app).toContain(`path="${path}"`);
    }
    // shells remain for unfinished products
    expect(app).toContain("ChristmasSantaVideoPage");
    expect(app).toContain('path="/christmas/santa-video"');
    expect(app).toContain("ChristmasShellRoute");
  });

  it("checkout + generate use server registry and never trust client prompts", () => {
    expect(readSrc("supabase/functions/christmas-checkout/index.ts")).toContain("buildChristmasPortraitPrompt");
    expect(readSrc("supabase/functions/christmas-photo-generate/index.ts")).toContain("buildChristmasPortraitPrompt");
    expect(readSrc("supabase/functions/christmas-photo-generate/index.ts")).toContain("Never trust client-supplied prompts");
    expect(readSrc("supabase/functions/christmas-photo-funnel/index.ts")).toContain("validateSpecies");
    expect(readSrc("supabase/functions/christmas-photo-funnel/index.ts")).toContain("validatePetSpecies");
  });

  it("migration seeds vertical packages purchasable false", () => {
    const sql = readSrc("supabase/migrations/20260903010000_christmas_portrait_verticals.sql");
    expect(sql).toContain("christmas_family");
    expect(sql).toContain("purchasable = false");
    expect(sql).toContain("price_cents = 0");
    expect(sql).toContain("portrait_type");
    expect(sql).toContain("species");
  });

  it("family allows multiple people; couple V1 is single shared photo", () => {
    expect(CHRISTMAS_PORTRAIT_VERTICALS.family.allowMultiplePeople).toBe(true);
    expect(CHRISTMAS_PORTRAIT_VERTICALS.couples.uploadHint).toMatch(/both/i);
    expect(CHRISTMAS_PORTRAIT_VERTICALS.couples.heroSupport).not.toMatch(/two separate photos/i);
  });

  it("admin filters product + species", () => {
    const admin = readSrc("src/pages/admin/ChristmasOrders.tsx");
    expect(admin).toContain("christmas_family");
    expect(admin).toContain("speciesFilter");
    expect(admin).toContain("portrait_type");
  });
});

describe("christmas portrait funnel e2e contract (component)", () => {
  it("shared funnel exposes upload → style → blur preview → offer for all verticals", () => {
    const page = readSrc("src/features/christmas/ChristmasPortraitFunnelPage.tsx");
    expect(page).toContain("Upload your photo");
    expect(page).toContain("Choose a Christmas style");
    expect(page).toContain("createBlurredOriginalPreview");
    expect(page).toContain("Continue to offer");
    expect(page).toContain("Production checkout is not enabled yet");
    expect(page).toContain("Switch to");
    expect(page).toContain("/christmas/cats");
    expect(page).toContain("/christmas/dogs");
  });
});
