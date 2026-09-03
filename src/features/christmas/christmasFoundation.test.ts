import { describe, expect, it } from "vitest";
import {
  CHRISTMAS_CATALOG_SEED,
  findProduct,
  resolvePurchasableOffer,
  hubProducts,
  ctaStateForProduct,
  type ChristmasProductDef,
} from "./catalog";
import { planChristmasCheckout, christmasCheckoutEnabled } from "./checkout";
import {
  applyPaymentPaid,
  isIdempotentPaidReplay,
} from "./orderStatus";
import {
  CHRISTMAS_FUNNEL_ALLOWED_EVENTS,
  ChristmasFunnelIngestError,
  validateChristmasFunnelIngestPayload,
} from "./funnelEventContract";
import {
  canEnqueueFulfillment,
  enqueueChristmasFulfillment,
} from "./fulfillment";
import {
  CHRISTMAS_ROUTE_SHELLS,
  shellExposesCheckout,
  shellForPath,
} from "./routes";

function withPurchasablePhoto(priceCents = 1500): ChristmasProductDef[] {
  return CHRISTMAS_CATALOG_SEED.map((product) => {
    if (product.productKey !== "christmas_photo") return product;
    return {
      ...product,
      packages: product.packages.map((pkg) => ({
        ...pkg,
        purchasable: true,
        priceCents,
      })),
    };
  });
}

describe("christmas catalog", () => {
  it("resolves active christmas_photo product", () => {
    const product = findProduct(CHRISTMAS_CATALOG_SEED, "christmas_photo");
    expect(product?.active).toBe(true);
    expect(product?.routePath).toBe("/christmas/photo-generator");
  });

  it("rejects unknown product", () => {
    const result = resolvePurchasableOffer({
      catalog: CHRISTMAS_CATALOG_SEED,
      productKey: "nope",
      packageKey: "single",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown_product");
  });

  it("rejects inactive / non-purchasable package", () => {
    const result = resolvePurchasableOffer({
      catalog: CHRISTMAS_CATALOG_SEED,
      productKey: "christmas_photo",
      packageKey: "single",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_purchasable");
  });

  it("hub products exclude hub itself and keep discoverable suite entries", () => {
    const hub = hubProducts(CHRISTMAS_CATALOG_SEED);
    expect(hub.every((p) => p.productKey !== "christmas_hub")).toBe(true);
    expect(hub.some((p) => p.productKey === "christmas_photo")).toBe(true);
    expect(ctaStateForProduct(findProduct(CHRISTMAS_CATALOG_SEED, "christmas_santa_video")!)).toBe(
      "open",
    );
  });
});

describe("christmas pricing security", () => {
  it("ignores client price tampering and uses configured amount", () => {
    const catalog = withPurchasablePhoto(1500);
    const result = resolvePurchasableOffer({
      catalog,
      productKey: "christmas_photo",
      packageKey: "single",
      clientAmountCents: 1,
      clientCurrency: "eur",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amountCents).toBe(1500);
      expect(result.currency).toBe("usd");
    }
  });

  it("planChristmasCheckout rejects when kill switch is off", () => {
    const prev = process.env.CHRISTMAS_CHECKOUT_ENABLED;
    delete process.env.CHRISTMAS_CHECKOUT_ENABLED;
    expect(christmasCheckoutEnabled()).toBe(false);
    const plan = planChristmasCheckout({
      catalog: withPurchasablePhoto(1500),
      productKey: "christmas_photo",
      packageKey: "single",
      clientAmountCents: 1,
      successUrl: "https://example.com/success",
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.code).toBe("checkout_disabled");
    if (prev == null) delete process.env.CHRISTMAS_CHECKOUT_ENABLED;
    else process.env.CHRISTMAS_CHECKOUT_ENABLED = prev;
  });

  it("planChristmasCheckout uses authoritative amount when enabled", () => {
    const prev = process.env.CHRISTMAS_CHECKOUT_ENABLED;
    process.env.CHRISTMAS_CHECKOUT_ENABLED = "true";
    const plan = planChristmasCheckout({
      catalog: withPurchasablePhoto(2200),
      productKey: "christmas_photo",
      packageKey: "single",
      clientAmountCents: 1,
      successUrl: "https://example.com/success",
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.amountCents).toBe(2200);
      expect(plan.metadata.product_family).toBe("christmas");
    }
    if (prev == null) delete process.env.CHRISTMAS_CHECKOUT_ENABLED;
    else process.env.CHRISTMAS_CHECKOUT_ENABLED = prev;
  });
});

describe("christmas orders payment transitions", () => {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    paymentStatus: "pending" as const,
    fulfillmentStatus: "not_started" as const,
    amountCents: 1500,
    currency: "usd",
    stripeCheckoutSessionId: "cs_test_1",
    productKey: "christmas_photo",
    packageKey: "single",
  };

  it("creates paid transition and queues fulfillment", () => {
    const result = applyPaymentPaid({
      order: base,
      stripeSessionId: "cs_test_1",
      stripeAmountCents: 1500,
      stripeCurrency: "usd",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyPaid).toBe(false);
      expect(result.order.paymentStatus).toBe("paid");
      expect(result.order.fulfillmentStatus).toBe("queued");
    }
  });

  it("is idempotent on duplicate paid webhook", () => {
    const first = applyPaymentPaid({
      order: base,
      stripeSessionId: "cs_test_1",
      stripeAmountCents: 1500,
      stripeCurrency: "usd",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyPaymentPaid({
      order: first.order,
      stripeSessionId: "cs_test_1",
      stripeAmountCents: 1500,
      stripeCurrency: "usd",
    });
    expect(isIdempotentPaidReplay(second)).toBe(true);
  });

  it("rejects amount mismatch", () => {
    const result = applyPaymentPaid({
      order: base,
      stripeSessionId: "cs_test_1",
      stripeAmountCents: 1,
      stripeCurrency: "usd",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("amount_mismatch");
  });
});

describe("christmas analytics contract", () => {
  it("accepts allowed event with attribution fields", () => {
    const session = "22222222-2222-4222-8222-222222222222";
    const validated = validateChristmasFunnelIngestPayload({
      event_name: "christmas_page_view",
      funnel_session_id: session,
      product_key: "christmas_photo",
      package_key: "single",
      locale: "en",
      pathname: "/christmas",
      landing_path: "/christmas?utm_source=meta",
      utm_source: "meta",
      utm_campaign: "xmas",
      affiliate_ref: "partner1",
      campaign_id: "123",
      has_fbclid: true,
    });
    expect(validated.eventName).toBe("christmas_page_view");
    expect(validated.productKey).toBe("christmas_photo");
    expect(validated.utmSource).toBe("meta");
    expect(validated.affiliateRef).toBe("partner1");
    expect(validated.hasFbclid).toBe(true);
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("purchase");
  });

  it("rejects invalid event", () => {
    expect(() =>
      validateChristmasFunnelIngestPayload({
        event_name: "not_a_real_event",
        funnel_session_id: "22222222-2222-4222-8222-222222222222",
      }),
    ).toThrow(ChristmasFunnelIngestError);
  });
});

describe("christmas routes / activation", () => {
  it("wires suite shells and never exposes checkout on shells", () => {
    expect(shellForPath("/christmas/photo-generator")).toBeNull();
    expect(shellForPath("/christmas/santa-video")).toBeNull();
    expect(shellForPath("/christmas/kids")?.noindex).toBe(true);
    for (const shell of CHRISTMAS_ROUTE_SHELLS) {
      expect(shellExposesCheckout(shell)).toBe(false);
    }
  });
});

describe("christmas fulfillment seam", () => {
  it("does not invent handlers or fake results", async () => {
    const gate = canEnqueueFulfillment({
      id: "1",
      productKey: "christmas_photo",
      packageKey: "single",
      paymentStatus: "paid",
      fulfillmentStatus: "queued",
    });
    expect(gate.ok).toBe(true);
    const result = await enqueueChristmasFulfillment({
      id: "1",
      productKey: "christmas_photo",
      packageKey: "single",
      paymentStatus: "paid",
      fulfillmentStatus: "queued",
    });
    expect(result.enqueued).toBe(false);
    expect(result.reason).toBe("handler_not_implemented");
  });
});
