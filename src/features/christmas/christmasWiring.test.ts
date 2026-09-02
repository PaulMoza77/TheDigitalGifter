import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSrc(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), "utf8");
}

describe("christmas foundation wiring", () => {
  it("registers christmas suite routes before SEO catch-all", () => {
    const app = readSrc("src/App.tsx");
    const photo = app.indexOf('path="/christmas/photo-generator"');
    const seo = app.indexOf('path="/:pageType/:slug"');
    expect(photo).toBeGreaterThan(-1);
    expect(seo).toBeGreaterThan(photo);
    expect(app).toContain('path="/christmas/santa-video"');
    expect(app).toContain('path="christmas-orders"');
  });

  it("does not remove classic /christmas hub route", () => {
    expect(readSrc("src/App.tsx")).toContain('path="/christmas"');
    expect(readSrc("src/pages/website/ChristmasPage.tsx")).toContain(
      'occasion="christmas"',
    );
    expect(readSrc("src/pages/website/ChristmasPage.tsx")).toContain(
      "/generator?occasion=christmas",
    );
  });

  it("leaves pet SKU constraint and prices alone", () => {
    const migration = readSrc(
      "supabase/migrations/20260902120000_christmas_commerce_foundation.sql",
    );
    expect(migration).not.toContain("pet_orders_sku_chk");
    expect(migration).not.toContain("drop table public.pet_orders");
    expect(readSrc("src/features/pet/types.ts")).toContain("PET_PRICE_CENTS = 2700");
    expect(readSrc("src/features/pet-v2/types.ts")).toContain("PET_V2_PRICE_CENTS = 800");
    expect(readSrc("src/features/pet-v3/types.ts")).toContain("PET_V3_PRICE_CENTS = 1200");
  });

  it("wires christmas stripe fulfill without replacing pet handler", () => {
    const webhook = readSrc("supabase/functions/stripe-webhook/index.ts");
    expect(webhook).toContain("handleChristmasStripeEvent");
    expect(webhook).toContain("handlePetStripeEvent");
    expect(webhook).toContain("isPetCheckoutMetadata");
  });

  it("documents ADR and foundation", () => {
    expect(readSrc("docs/architecture/TDG_CHRISTMAS_COMMERCE_ADR.md")).toContain(
      "christmas_orders",
    );
    expect(readSrc("docs/TDG_CHRISTMAS_FOUNDATION.md")).toContain("fulfillment_status");
  });
});
