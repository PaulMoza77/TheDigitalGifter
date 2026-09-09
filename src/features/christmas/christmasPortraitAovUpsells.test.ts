import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHRISTMAS_CATALOG_SEED,
  findProduct,
  type ChristmasProductDef,
} from "./catalog";
import {
  CHRISTMAS_FUNNEL_ALLOWED_EVENTS,
  validateChristmasFunnelIngestPayload,
} from "./funnelEventContract";
import { planChristmasCheckout, planChristmasUpsellCheckout } from "./checkout";
import {
  CHRISTMAS_V2_PACK_KEYS,
  PORTRAIT_AOV_PACKAGE_KEYS,
  PORTRAIT_AOV_PRODUCT_KEYS,
  isChristmasV2PackKey,
  listPortraitAovOffers,
  resolvePortraitAovOffer,
} from "./upsells";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function withPricedUpsell(
  productKey: string,
  packageKey: string,
  priceCents: number,
): ChristmasProductDef[] {
  return CHRISTMAS_CATALOG_SEED.map((product) => {
    if (product.productKey !== productKey) return product;
    return {
      ...product,
      packages: product.packages.map((pkg) =>
        pkg.packageKey === packageKey
          ? { ...pkg, purchasable: true, priceCents }
          : pkg,
      ),
    };
  });
}

describe("christmas portrait AOV catalog", () => {
  for (const productKey of PORTRAIT_AOV_PRODUCT_KEYS) {
    it(`${productKey} seeds extra_images / extra_styles / video unpublished`, () => {
      const product = findProduct(CHRISTMAS_CATALOG_SEED, productKey);
      expect(product).toBeTruthy();
      for (const packageKey of PORTRAIT_AOV_PACKAGE_KEYS) {
        const pkg = product?.packages.find((p) => p.packageKey === packageKey);
        expect(pkg?.active).toBe(true);
        expect(pkg?.purchasable).toBe(false);
        expect(pkg?.priceCents).toBe(0);
        expect(pkg?.metadata?.kind).toBe("upsell");
        expect(pkg?.metadata?.v2_pack).toBe(false);
      }
      expect(product?.packages.some((p) => isChristmasV2PackKey(p.packageKey))).toBe(false);
    });
  }

  it("does not invent a live client amount", () => {
    const offers = listPortraitAovOffers({ productKey: "christmas_photo" });
    expect(offers).toHaveLength(3);
    expect(offers.every((o) => o.amountCents === null && o.purchasable === false)).toBe(true);
  });

  it("rejects V2 pack keys as suite AOV", () => {
    for (const pack of CHRISTMAS_V2_PACK_KEYS) {
      const result = resolvePortraitAovOffer({
        productKey: "christmas_photo",
        packageKey: pack,
        clientAmountCents: 299,
      });
      expect(result.ok).toBe(false);
    }
  });
});

describe("christmas portrait AOV pricing security", () => {
  it("ignores client amount when founder enables a package", () => {
    const catalog = withPricedUpsell("christmas_family", "extra_images", 900);
    const result = resolvePortraitAovOffer({
      catalog,
      productKey: "christmas_family",
      packageKey: "extra_images",
      clientAmountCents: 1,
      clientCurrency: "eur",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amountCents).toBe(900);
      expect(result.currency).toBe("usd");
    }
  });

  it("planChristmasUpsellCheckout stays founder-gated and uses server cents", () => {
    const prev = process.env.CHRISTMAS_CHECKOUT_ENABLED;
    delete process.env.CHRISTMAS_CHECKOUT_ENABLED;
    const blocked = planChristmasUpsellCheckout({
      catalog: withPricedUpsell("christmas_pet", "video", 1200),
      productKey: "christmas_pet",
      packageKey: "video",
      clientAmountCents: 1,
      successUrl: "https://example.com/success",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("checkout_disabled");

    process.env.CHRISTMAS_CHECKOUT_ENABLED = "true";
    const unpaid = planChristmasUpsellCheckout({
      catalog: withPricedUpsell("christmas_couple", "extra_styles", 700),
      productKey: "christmas_couple",
      packageKey: "extra_styles",
      parentOrderPaid: false,
      successUrl: "https://example.com/success",
    });
    expect(unpaid.ok).toBe(false);

    const plan = planChristmasUpsellCheckout({
      catalog: withPricedUpsell("christmas_couple", "extra_styles", 700),
      productKey: "christmas_couple",
      packageKey: "extra_styles",
      parentOrderPaid: true,
      clientAmountCents: 9,
      successUrl: "https://example.com/success",
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.amountCents).toBe(700);
      expect(plan.metadata.product_type).toBe("christmas_upsell");
      expect(plan.metadata.product_family).toBe("christmas");
    }

    const primary = planChristmasCheckout({
      catalog: withPricedUpsell("christmas_photo", "single", 1500),
      productKey: "christmas_photo",
      packageKey: "single",
      successUrl: "https://example.com/success",
    });
    expect(primary.ok).toBe(true);
    if (primary.ok) expect(primary.amountCents).toBe(1500);

    if (prev == null) delete process.env.CHRISTMAS_CHECKOUT_ENABLED;
    else process.env.CHRISTMAS_CHECKOUT_ENABLED = prev;
  });
});

describe("christmas portrait AOV analytics + fulfill wiring", () => {
  it("reserved events accept upsell_viewed and upsell_purchase", () => {
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("upsell_viewed");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("upsell_purchase");
    const session = "22222222-2222-4222-8222-222222222222";
    const viewed = validateChristmasFunnelIngestPayload({
      event_name: "upsell_viewed",
      funnel_session_id: session,
      product_key: "christmas_photo",
      package_key: "extra_images",
    });
    expect(viewed.eventName).toBe("upsell_viewed");
    const purchase = validateChristmasFunnelIngestPayload({
      event_name: "upsell_purchase",
      funnel_session_id: session,
      product_key: "christmas_family",
      package_key: "video",
      amount_cents: 0,
    });
    expect(purchase.eventName).toBe("upsell_purchase");
  });

  it("migration seeds unpublished AOV packages and fulfill RPC", () => {
    const sql = readSrc("supabase/migrations/20260909180000_christmas_portrait_aov_upsells.sql");
    expect(sql).toContain("extra_images");
    expect(sql).toContain("extra_styles");
    expect(sql).toContain("christmas_order_upsells");
    expect(sql).toContain("fulfill_christmas_upsell_payment");
    expect(sql).toContain("purchasable = false");
    expect(sql).toContain("price_cents = 0");
    expect(sql).toContain("package_key not in ('starter', 'magic', 'ultimate')");
  });

  it("checkout + webhook + generate use server packages, not client cents", () => {
    const checkout = readSrc("supabase/functions/christmas-checkout/index.ts");
    expect(checkout).toContain("parent_public_token");
    expect(checkout).toContain("christmas_upsell");
    expect(checkout).toContain("void body.amount_cents");
    expect(checkout).toContain("pkg.price_cents");
    expect(checkout).not.toContain("CHRISTMAS_PACKS");

    const fulfill = readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts");
    expect(fulfill).toContain("handleChristmasUpsellStripeEvent");
    expect(readSrc("supabase/functions/_shared/christmas/stripeUpsellFulfill.ts")).toContain(
      "fulfill_christmas_upsell_payment",
    );
    expect(readSrc("supabase/functions/_shared/christmas/stripeUpsellFulfill.ts")).toContain(
      "upsell_purchase",
    );

    const generate = readSrc("supabase/functions/christmas-photo-generate/index.ts");
    expect(generate).toContain("upsell_id");
    expect(generate).toContain("extra_images");
    expect(generate).toContain("extra_styles");
    expect(generate).toContain("fulfill_kind");
  });

  it("result UI never hardcodes a dollar amount", () => {
    const panel = readSrc("src/features/christmas/components/PortraitAovUpsellPanel.tsx");
    expect(panel).toContain("upsell_viewed");
    expect(panel).toContain("formatServerPrice");
    expect(panel).not.toMatch(/\$\d+/);
    expect(panel).not.toContain("starter");
    expect(readSrc("src/features/christmas/ChristmasPortraitFunnelPage.tsx")).toContain(
      "PortraitAovUpsellPanel",
    );
  });
});
