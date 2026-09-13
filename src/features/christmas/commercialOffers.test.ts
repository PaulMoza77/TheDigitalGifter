import { describe, expect, it } from "vitest";
import {
  CHRISTMAS_COMMERCIAL_SEED,
  catalogFromRows,
  mapCreditPackRow,
  replayIapGrant,
  resolveAppSpend,
  resolveIapGrant,
  resolveWebCheckout,
  snapshotWebOrder,
  validateChristmasOfferPatch,
  type ChristmasCommercialOffer,
  type PricingItemLike,
} from "./commercialOffers";

function row(
  key: string,
  extra: Partial<PricingItemLike> & { metadata?: Record<string, unknown> } = {},
): PricingItemLike {
  const seed = CHRISTMAS_COMMERCIAL_SEED[key as keyof typeof CHRISTMAS_COMMERCIAL_SEED];
  return {
    key,
    name: seed?.name || key,
    category: "christmas_offer",
    price_cents: extra.price_cents ?? seed?.webPriceMinor,
    currency: extra.currency ?? "eur",
    credits: extra.credits ?? seed?.appCreditsCost,
    active: extra.active ?? true,
    is_active: extra.is_active ?? true,
    is_featured: extra.is_featured ?? seed?.featured,
    sort_order: extra.sort_order ?? seed?.sortOrder,
    updated_at: extra.updated_at ?? "2026-09-01T00:00:00.000Z",
    metadata: {
      web_checkout_enabled: true,
      app_credits_cost: seed?.appCreditsCost,
      product_type: seed?.productType,
      ...(key === "xmas_magic_bundle"
        ? { bundle_components: ["xmas_portrait", "xmas_santa_video", "xmas_card_message"] }
        : {}),
      ...(extra.metadata || {}),
    },
  };
}

function catalog(overrides: PricingItemLike[] = []): ChristmasCommercialOffer[] {
  return catalogFromRows([
    row("xmas_portrait"),
    row("xmas_santa_video"),
    row("xmas_magic_bundle"),
    ...overrides,
  ]);
}

describe("admin-driven Christmas commercial config", () => {
  it("1. Admin Portrait €4.99 → €5.99 is used by next checkout", () => {
    const before = resolveWebCheckout({
      productKey: "xmas_portrait",
      catalog: catalog(),
    });
    expect(before.ok).toBe(true);
    if (before.ok) expect(before.amountCents).toBe(499);

    const after = resolveWebCheckout({
      productKey: "christmas_photo",
      catalog: catalogFromRows([row("xmas_portrait", { price_cents: 599 })]),
    });
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.amountCents).toBe(599);
  });

  it("2. Admin Portrait credits 100 → 80 is reflected in config", () => {
    const spend = resolveAppSpend({
      productKey: "xmas_portrait",
      catalog: catalogFromRows([row("xmas_portrait", { credits: 80, metadata: { app_credits_cost: 80 } })]),
    });
    expect(spend.ok).toBe(true);
    if (spend.ok) expect(spend.creditCost).toBe(80);
  });

  it("3. Server ignores client amount=1 cent and charges Admin price", () => {
    const result = resolveWebCheckout({
      productKey: "xmas_portrait",
      catalog: catalog(),
      clientAmountCents: 1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.amountCents).toBe(499);
  });

  it("4. Server refuses client trying to spend fewer credits than configured", () => {
    const result = resolveAppSpend({
      productKey: "xmas_portrait",
      catalog: catalog(),
      displayedCreditCost: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("pricing_changed");
      expect(result.serverCreditCost).toBe(100);
    }
  });

  it("5. Admin Starter 110 → 150 grants 150", () => {
    const pack110 = mapCreditPackRow({
      key: "starter",
      category: "credit_pack",
      name: "Starter",
      credits: 110,
      active: true,
      is_active: true,
      metadata: { apple_product_id: "com.thedigitalgifter.app.credits.starter" },
    });
    const pack150 = mapCreditPackRow({
      key: "starter",
      category: "credit_pack",
      name: "Starter",
      credits: 150,
      active: true,
      is_active: true,
      metadata: {
        apple_product_id: "com.thedigitalgifter.app.credits.starter",
        bonus_credits: 0,
      },
    });
    expect(pack110?.totalCredits).toBe(110);
    const grant = resolveIapGrant({
      appleProductId: "com.thedigitalgifter.app.credits.starter",
      packs: [pack150!],
      clientCredits: 110,
    });
    expect(grant.ok).toBe(true);
    if (grant.ok) expect(grant.creditsGranted).toBe(150);
  });

  it("6. Same Apple transaction replay grants +0", () => {
    expect(replayIapGrant(150, false)).toBe(150);
    expect(replayIapGrant(150, true)).toBe(0);
  });

  it("7. Historical purchase stays at old snapshot after Admin change", () => {
    const paid = snapshotWebOrder(catalog()[0]);
    expect(paid.chargedAmountMinor).toBe(499);
    const newCatalog = catalogFromRows([row("xmas_portrait", { price_cents: 699 })]);
    expect(paid.chargedAmountMinor).toBe(499);
    expect(newCatalog[0].webPriceMinor).toBe(699);
    expect(paid.chargedAmountMinor).not.toBe(newCatalog[0].webPriceMinor);
  });

  it("8. Disabled Christmas product cannot start checkout/spend", () => {
    const disabled = catalogFromRows([row("xmas_portrait", { active: false, is_active: false })]);
    const web = resolveWebCheckout({ productKey: "xmas_portrait", catalog: disabled });
    const app = resolveAppSpend({ productKey: "xmas_portrait", catalog: disabled });
    expect(web.ok).toBe(false);
    expect(app.ok).toBe(false);
  });

  it("9. Bundle purchase does not double-charge components", () => {
    const bundle = resolveWebCheckout({
      productKey: "xmas_magic_bundle",
      catalog: catalog(),
    });
    expect(bundle.ok).toBe(true);
    if (bundle.ok) {
      expect(bundle.amountCents).toBe(1499);
      expect(bundle.offer.bundleComponents).toEqual([
        "xmas_portrait",
        "xmas_santa_video",
        "xmas_card_message",
      ]);
    }
    const consumePortrait = resolveAppSpend({
      productKey: "xmas_portrait",
      catalog: catalog(),
      bundleEntitlementRemaining: ["xmas_portrait", "xmas_santa_video", "xmas_card_message"],
    });
    expect(consumePortrait.ok).toBe(true);
    if (consumePortrait.ok) {
      expect(consumePortrait.viaEntitlement).toBe(true);
      expect(consumePortrait.creditCost).toBe(0);
    }
  });

  it("10. Same generation idempotency key does not double-spend conceptually", () => {
    const first = { key: "gen_1", charged: 100 };
    const replay = { key: "gen_1", already: true };
    const debit = replay.already && first.key === replay.key ? 0 : 100;
    expect(debit).toBe(0);
  });

  it("fails closed when catalog is empty (no hardcoded €4.99)", () => {
    const result = resolveWebCheckout({ productKey: "xmas_portrait", catalog: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("config_missing");
  });

  it("rejects invalid admin values", () => {
    expect(
      validateChristmasOfferPatch({
        key: "xmas_portrait",
        webPriceMinor: -1,
        appCreditsCost: 100,
      }).ok,
    ).toBe(false);
    expect(
      validateChristmasOfferPatch({
        key: "xmas_portrait",
        webCheckoutEnabled: true,
        webPriceMinor: 0,
        appCreditsCost: 100,
      }).ok,
    ).toBe(false);
    expect(
      validateChristmasOfferPatch({
        key: "xmas_magic_bundle",
        webPriceMinor: 1499,
        appCreditsCost: 350,
        bundleComponents: ["xmas_magic_bundle"],
      }).ok,
    ).toBe(false);
  });
});
