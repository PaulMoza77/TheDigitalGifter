import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHRISTMAS_PAYMENT_REQUIRED_HTTP,
  assertStyleAllowed,
  canGenerateChristmasPhoto,
  christmasOrderIsPaid,
  clientPaymentClaimAuthorizesGeneration,
  interpretChristmasGenerationClaim,
  parseChristmasGenerationClaim,
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
    expect(readSrc("src/features/christmas/ChristmasPortraitFunnelPage.tsx")).toContain(
      "createBlurredOriginalPreview",
    );
    expect(readSrc("src/features/christmas/ChristmasPortraitFunnelPage.tsx")).not.toContain(
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

  it("treats payment_status as source of truth over paid_at", () => {
    expect(christmasOrderIsPaid({ paymentStatus: "pending", paidAt: "2026-09-02T00:00:00Z" })).toBe(false);
    expect(christmasOrderIsPaid({ paymentStatus: "paid", paidAt: null })).toBe(true);
    expect(christmasOrderIsPaid({ paymentStatus: null, paidAt: "2026-09-02T00:00:00Z" })).toBe(true);
    expect(christmasOrderIsPaid({ paymentStatus: "", paidAt: null })).toBe(false);
  });

  it("maps unpaid claim RPC to HTTP 402, never 200", () => {
    const unpaid = interpretChristmasGenerationClaim({
      claimed: false,
      reason: "payment_required",
      payment_status: "draft",
    });
    expect(unpaid.kind).toBe("payment_required");
    if (unpaid.kind !== "payment_required") return;
    expect(unpaid.httpStatus).toBe(CHRISTMAS_PAYMENT_REQUIRED_HTTP);
    expect(unpaid.body.code).toBe("payment_required");

    const parsed = parseChristmasGenerationClaim(
      JSON.stringify({ claimed: false, reason: "payment_required", payment_status: "pending" }),
    );
    expect(interpretChristmasGenerationClaim(parsed).kind).toBe("payment_required");

    const replay = interpretChristmasGenerationClaim({ claimed: false, status: "already_running" });
    expect(replay.kind).toBe("not_claimed");
    expect(interpretChristmasGenerationClaim({ claimed: true }).kind).toBe("proceed");
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
    expect(app).toContain("ChristmasPortraitFunnelPage");
    expect(app.indexOf("ChristmasPortraitFunnelPage")).toBeLessThan(
      app.indexOf('path="/christmas/kids"'),
    );
  });

  it("webhook enqueues christmas-photo-generate after paid", () => {
    expect(readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts")).toContain(
      "christmas-photo-generate",
    );
    expect(readSrc("supabase/functions/christmas-photo-generate/index.ts")).toContain(
      "christmasOrderIsPaid",
    );
  });

  it("claim RPC migration requires payment_status paid", () => {
    const sql = readSrc(
      "supabase/migrations/20260902150000_christmas_claim_requires_paid.sql",
    );
    expect(sql).toContain("payment_status <> 'paid'");
    expect(sql).toContain("payment_required");
    expect(sql).toContain("grant execute on function public.claim_christmas_generation_job(uuid) to service_role");
    expect(sql).toContain("revoke all on function public.claim_christmas_generation_job(uuid) from anon, authenticated, public");
  });

  it("generate handlers are service-role, unpaid 402, and honor claim payment_required", () => {
    const photo = readSrc("supabase/functions/christmas-photo-generate/index.ts");
    const edge = readSrc("supabase/functions/christmas-generate/index.ts");
    const node = readSrc("api/christmas-generate.ts");
    for (const src of [photo, edge, node]) {
      expect(src).toContain("isServiceRoleRequest");
      expect(src).toContain("christmasOrderIsPaid");
      expect(src).toContain("interpretChristmasGenerationClaim");
      expect(src).toContain("generationMock");
    }
    expect(photo).toContain("claim_christmas_generation_job");
    expect(photo).toContain("black-forest-labs/flux-kontext-pro");
    expect(edge).toContain("claim_christmas_v2_generation_job");
    expect(node).toContain("claim_christmas_v2_generation_job");
    expect(node).toContain("christmas_v2_orders");
  });

  it("keeps production purchase disabled in seed catalog", () => {
    const pkg = CHRISTMAS_CATALOG_SEED
      .find((p) => p.productKey === "christmas_photo")
      ?.packages.find((item) => item.packageKey === "single");
    expect(pkg?.purchasable).toBe(false);
    expect(pkg?.priceCents).toBe(0);
    expect(readSrc("src/features/christmas/checkout.ts")).toContain("CHRISTMAS_CHECKOUT_ENABLED");
  });
});
