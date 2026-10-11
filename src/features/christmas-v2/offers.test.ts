import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHRISTMAS_ACTIVE_SKUS,
  CHRISTMAS_ALLOWED_SKUS,
  CHRISTMAS_COGS_ESTIMATE,
  CHRISTMAS_PACK_OFFERS,
  CHRISTMAS_V2_CURRENCY,
  CHRISTMAS_V2_OFFER_CATALOG_VERSION,
  assertChargeMatchesSnapshot,
  snapshotOffer,
} from "./offers";
import { CHRISTMAS_PACKS, CHRISTMAS_STARTER_SCENES, CHRISTMAS_UPSELL_SCENES } from "./config";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("christmas-v2 EUR offer contract", () => {
  it("defines EUR 7 / 17 / 27 with 3/0 · 5/1 · 10/3 entitlements", () => {
    expect(CHRISTMAS_V2_CURRENCY).toBe("eur");
    expect(CHRISTMAS_PACK_OFFERS.starter).toMatchObject({
      amountCents: 700,
      imageCount: 3,
      videoCount: 0,
      currency: "eur",
      sku: "christmas-starter-eur7",
    });
    expect(CHRISTMAS_PACK_OFFERS.magic).toMatchObject({
      amountCents: 1700,
      imageCount: 5,
      videoCount: 1,
      currency: "eur",
      sku: "christmas-magic-eur17",
    });
    expect(CHRISTMAS_PACK_OFFERS.ultimate).toMatchObject({
      amountCents: 2700,
      imageCount: 10,
      videoCount: 3,
      currency: "eur",
      sku: "christmas-ultimate-eur27",
    });
  });

  it("mirrors pack offers into CHRISTMAS_PACKS UI config", () => {
    expect(CHRISTMAS_PACKS.starter.priceCents).toBe(700);
    expect(CHRISTMAS_PACKS.magic.imageCount).toBe(5);
    expect(CHRISTMAS_PACKS.ultimate.videoCount).toBe(3);
    expect(CHRISTMAS_PACKS.starter.priceDisplay).toContain("€");
  });

  it("keeps enough scene inventory for the largest pack", () => {
    expect(CHRISTMAS_STARTER_SCENES).toHaveLength(3);
    expect(CHRISTMAS_STARTER_SCENES.length + CHRISTMAS_UPSELL_SCENES.length).toBeGreaterThanOrEqual(10);
  });

  it("snapshots each pack immutably for order persistence", () => {
    const snap = snapshotOffer("magic");
    expect(snap).toEqual({
      catalogVersion: CHRISTMAS_V2_OFFER_CATALOG_VERSION,
      packKey: "magic",
      sku: "christmas-magic-eur17",
      amountCents: 1700,
      currency: "eur",
      imageCount: 5,
      videoCount: 1,
    });
  });

  it("rejects Stripe amount or currency mismatches against the snapshot", () => {
    expect(
      assertChargeMatchesSnapshot({
        orderAmountCents: 700,
        orderCurrency: "eur",
        stripeAmountCents: 700,
        stripeCurrency: "eur",
      }).ok,
    ).toBe(true);
    expect(
      assertChargeMatchesSnapshot({
        orderAmountCents: 1700,
        orderCurrency: "eur",
        stripeAmountCents: 800,
        stripeCurrency: "eur",
      }),
    ).toMatchObject({ ok: false, code: "amount_mismatch" });
    expect(
      assertChargeMatchesSnapshot({
        orderAmountCents: 2700,
        orderCurrency: "eur",
        stripeAmountCents: 2700,
        stripeCurrency: "usd",
      }),
    ).toMatchObject({ ok: false, code: "currency_mismatch" });
  });

  it("preserves legacy USD SKUs in the allowlist for historical orders", () => {
    expect(CHRISTMAS_ALLOWED_SKUS).toEqual(
      expect.arrayContaining([
        ...CHRISTMAS_ACTIVE_SKUS,
        "christmas-starter-3",
        "christmas-magic-8",
        "christmas-ultimate-12",
      ]),
    );
  });

  it("keeps estimated COGS below pack EUR list prices", () => {
    expect(CHRISTMAS_COGS_ESTIMATE.starter.totalUsd).toBeLessThan(7);
    expect(CHRISTMAS_COGS_ESTIMATE.magic.totalUsd).toBeLessThan(17);
    expect(CHRISTMAS_COGS_ESTIMATE.ultimate.totalUsd).toBeLessThan(27);
  });

  it("keeps Edge/Node offer modules byte-identical to the frontend contract", () => {
    const frontend = read("src/features/christmas-v2/offers.ts");
    expect(read("supabase/functions/_shared/christmas/offers.ts")).toBe(frontend);
    expect(read("api/_lib/christmas/offers.ts")).toBe(frontend);
  });

  it("wires Stripe checkout currency and providers without Replicate fallback", () => {
    const funnel = read("supabase/functions/christmas-funnel/index.ts");
    expect(funnel).toContain("CHRISTMAS_V2_CURRENCY");
    expect(funnel).not.toContain('currency: "usd"');
    expect(funnel).not.toContain('price_data][currency]", "usd"');

    const image = read("supabase/functions/christmas-generate/index.ts");
    expect(image).toContain("generateSoulV2Image");
    expect(image).toContain("christmas_v2_finalize_generation_if_done");
    expect(image).not.toContain("api.replicate.com");

    const video = read("supabase/functions/christmas-generate-video/index.ts");
    expect(video).toContain('from("christmas_v2_orders")');
    expect(video).toContain('from("christmas_v2_order_scenes")');
    expect(video).toContain('from("christmas_v2_order_videos")');
    expect(video).toContain("generateKling3ProVideo");
    expect(video).not.toContain('from("christmas_orders")');
    expect(video).not.toContain("api.replicate.com");

    const providers = read("supabase/functions/_shared/christmas/higgsfieldProviders.ts");
    expect(providers).toContain("does not fall back to Replicate");
    expect(providers).toContain("soulV2ImageRequest");
    expect(providers).toContain("kling3ProVideoRequest");

    const constants = read("supabase/functions/_shared/christmas/constants.ts");
    expect(constants).toContain('CHRISTMAS_SOUL_V2_IMAGE_MODEL = "higgsfield-ai/soul/v2/image-to-image"');
    expect(constants).toContain(
      'CHRISTMAS_KLING_3_PRO_VIDEO_MODEL = "kling-video/v3.0/pro/image-to-video"',
    );
  });

  it("ships a reversible migration for EUR SKUs and finalize remap", () => {
    const migration = read(
      "supabase/migrations/20261011140000_christmas_v2_eur_offers_and_finalize.sql",
    );
    expect(migration).toContain("christmas-starter-eur7");
    expect(migration).toContain("christmas-magic-eur17");
    expect(migration).toContain("christmas-ultimate-eur27");
    expect(migration).toContain("christmas-starter-3");
    expect(migration).toContain("currency in ('usd', 'eur')");
    expect(migration).toContain("christmas_v2_finalize_generation_if_done");
    expect(migration).toContain("amount mismatch");
    expect(migration).toContain("offer_snapshot");
  });
});
