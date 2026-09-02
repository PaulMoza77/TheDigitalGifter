import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertStyleAllowed,
  canGenerateChristmasPhoto,
  clientPaymentClaimAuthorizesGeneration,
} from "./generationGuards";
import {
  christmasPreviewUsesReplicate,
  validateChristmasPhotoFile,
} from "./photoPreview";
import { enabledChristmasStyles, resolveChristmasStyle } from "./styles";
import { resolvePurchasableOffer, CHRISTMAS_CATALOG_SEED } from "./catalog";
import { applyPaymentPaid, isIdempotentPaidReplay } from "./orderStatus";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("christmas photo styles", () => {
  it("exposes 6–8 enabled distinct styles", () => {
    const styles = enabledChristmasStyles();
    expect(styles.length).toBeGreaterThanOrEqual(6);
    expect(styles.length).toBeLessThanOrEqual(8);
    expect(resolveChristmasStyle("classic_christmas")?.promptTemplate.length).toBeGreaterThan(40);
  });

  it("rejects unknown / disabled styles server-side", () => {
    expect(assertStyleAllowed("nope").ok).toBe(false);
    const disabled = assertStyleAllowed("classic_christmas", [
      {
        styleKey: "classic_christmas",
        displayName: "Classic",
        description: "",
        enabled: false,
        sortOrder: 1,
        accent: "#000",
        promptTemplate: "x",
        negativeHints: "",
      },
    ]);
    expect(disabled.ok).toBe(false);
    if (!disabled.ok) expect(disabled.code).toBe("disabled_style");
  });
});

describe("christmas photo preview contract", () => {
  it("preview path never uses Replicate", () => {
    expect(christmasPreviewUsesReplicate()).toBe(false);
    expect(readSrc("src/features/christmas/photoPreview.ts")).not.toContain("replicate.com");
    expect(readSrc("src/features/christmas/ChristmasPhotoGeneratorPage.tsx")).toContain(
      "createBlurredOriginalPreview",
    );
    expect(readSrc("src/features/christmas/ChristmasPhotoGeneratorPage.tsx")).not.toContain(
      "pet-v2-preview",
    );
  });

  it("validates photo types without AI", async () => {
    const empty = new File([], "empty.jpg", { type: "image/jpeg" });
    const result = await validateChristmasPhotoFile(empty);
    expect(result.ok).toBe(false);
  });
});

describe("christmas photo payment gates generation", () => {
  it("unpaid cannot generate; client claim never authorizes", () => {
    expect(canGenerateChristmasPhoto({ paymentStatus: "pending" }).ok).toBe(false);
    expect(canGenerateChristmasPhoto({ paymentStatus: "paid" }).ok).toBe(true);
    expect(clientPaymentClaimAuthorizesGeneration({ paymentSucceeded: true })).toBe(false);
  });

  it("duplicate paid transition is idempotent", () => {
    const base = {
      id: "33333333-3333-4333-8333-333333333333",
      paymentStatus: "pending" as const,
      fulfillmentStatus: "not_started" as const,
      amountCents: 1500,
      currency: "usd",
      stripeCheckoutSessionId: "cs_test_x",
      productKey: "christmas_photo",
      packageKey: "single",
    };
    const first = applyPaymentPaid({
      order: base,
      stripeSessionId: "cs_test_x",
      stripeAmountCents: 1500,
      stripeCurrency: "usd",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyPaymentPaid({
      order: first.order,
      stripeSessionId: "cs_test_x",
      stripeAmountCents: 1500,
      stripeCurrency: "usd",
    });
    expect(isIdempotentPaidReplay(second)).toBe(true);
  });
});

describe("christmas photo pricing + wiring", () => {
  it("seed package remains non-purchasable / unpublished", () => {
    const result = resolvePurchasableOffer({
      catalog: CHRISTMAS_CATALOG_SEED,
      productKey: "christmas_photo",
      packageKey: "single",
      clientAmountCents: 1999,
    });
    expect(result.ok).toBe(false);
  });

  it("routes photo-generator to real page not shell", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain("ChristmasPhotoGeneratorPage");
    expect(app.indexOf("ChristmasPhotoGeneratorPage")).toBeLessThan(
      app.indexOf('path="/christmas/family"'),
    );
  });

  it("webhook enqueues christmas-generate after paid", () => {
    expect(readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts")).toContain(
      "christmas-generate",
    );
    expect(readSrc("supabase/functions/christmas-generate/index.ts")).toContain(
      'payment_status !== "paid"',
    );
  });
});
