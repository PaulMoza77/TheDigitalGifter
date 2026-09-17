import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_CATALOG_SEED, findProduct } from "../catalog";
import { planChristmasCheckout } from "../checkout";
import {
  CHRISTMAS_FUNNEL_ALLOWED_EVENTS,
  validateChristmasFunnelIngestPayload,
} from "../funnelEventContract";
import { newFunnelUuid } from "../funnelEventContract";
import { christmasSitemapPaths } from "../../../../server/christmasIndexing.mjs";
import { getChristmasSeo } from "../../../../server/christmasSeo.mjs";
import {
  addonsIncludedInPackage,
  entitlementsForSelection,
  PLANNER_PRODUCT_KEY,
  resolvePlannerCheckout,
} from "./commerce";
import { sanitizePlannerAnalyticsMetadata } from "./analyticsPrivacy";
import { plannerPurchaseEventId } from "./analyticsPrivacy";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function plannerCatalog() {
  return CHRISTMAS_CATALOG_SEED;
}

describe("christmas planner commerce", () => {
  it("uses server package prices and ignores forged client amounts", () => {
    const prev = process.env.CHRISTMAS_CHECKOUT_ENABLED;
    const prevPlanner = process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED;
    process.env.CHRISTMAS_CHECKOUT_ENABLED = "true";
    process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED = "true";
    const catalog = plannerCatalog().map((product) =>
      product.productKey === PLANNER_PRODUCT_KEY
        ? { ...product, metadata: { ...product.metadata, checkout_live: true } }
        : product,
    );
    const plan = resolvePlannerCheckout({
      catalog,
      packageKey: "essentials",
      clientAmountCents: 1,
      clientCurrency: "eur",
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.amountCents).toBe(1299);
      expect(plan.currency).toBe("usd");
    }
    if (prev == null) delete process.env.CHRISTMAS_CHECKOUT_ENABLED;
    else process.env.CHRISTMAS_CHECKOUT_ENABLED = prev;
    if (prevPlanner == null) delete process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED;
    else process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED = prevPlanner;
  });

  it("rejects unsupported packages", () => {
    process.env.CHRISTMAS_CHECKOUT_ENABLED = "true";
    process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED = "true";
    const catalog = plannerCatalog().map((p) =>
      p.productKey === PLANNER_PRODUCT_KEY ? { ...p, metadata: { ...p.metadata, checkout_live: true } } : p,
    );
    const plan = resolvePlannerCheckout({ catalog, packageKey: "deluxe_secret" });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.code).toBe("unknown_package");
  });

  it("does not charge add-ons already included in All-In", () => {
    process.env.CHRISTMAS_CHECKOUT_ENABLED = "true";
    process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED = "true";
    const catalog = plannerCatalog().map((p) =>
      p.productKey === PLANNER_PRODUCT_KEY ? { ...p, metadata: { ...p.metadata, checkout_live: true } } : p,
    );
    const plan = resolvePlannerCheckout({
      catalog,
      packageKey: "all_in",
      addonKeys: ["addon_recipes", "addon_hosting"],
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.amountCents).toBe(4900);
      expect(plan.addonKeys).toEqual([]);
      expect(plan.skippedAddonKeys).toEqual(["addon_recipes", "addon_hosting"]);
    }
  });

  it("maps package and add-on entitlements without duplicates", () => {
    expect(entitlementsForSelection({ packageKey: "essentials" })).toContain("planner.wishlist");
    expect(entitlementsForSelection({ packageKey: "essentials" })).not.toContain("planner.rescue_mode");
    const magic = entitlementsForSelection({ packageKey: "magic" });
    expect(magic).toContain("planner.rescue_mode");
    expect(new Set(magic).size).toBe(magic.length);
    expect(addonsIncludedInPackage("all_in")).toContain("addon_recipes");
  });

  it("disables checkout via kill switch even when seed prices exist", () => {
    const prev = process.env.CHRISTMAS_CHECKOUT_ENABLED;
    delete process.env.CHRISTMAS_CHECKOUT_ENABLED;
    delete process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED;
    const plan = resolvePlannerCheckout({
      catalog: plannerCatalog(),
      packageKey: "all_in",
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.code).toBe("checkout_disabled");
    const photo = planChristmasCheckout({
      catalog: plannerCatalog(),
      productKey: "christmas_photo",
      packageKey: "single",
      successUrl: "https://example.com",
    });
    expect(photo.ok).toBe(false);
    if (prev == null) delete process.env.CHRISTMAS_CHECKOUT_ENABLED;
    else process.env.CHRISTMAS_CHECKOUT_ENABLED = prev;
  });
});

describe("christmas planner privacy + attribution events", () => {
  it("allowlists planner funnel events", () => {
    for (const name of [
      "planner_landing_view",
      "planner_cta_clicked",
      "planner_package_viewed",
      "planner_package_selected",
      "planner_addon_selected",
      "planner_checkout_started",
      "planner_wallet_presented",
      "planner_payment_submitted",
      "planner_purchase",
      "planner_purchase_failed",
      "planner_welcome_view",
      "planner_claim_started",
      "planner_claim_completed",
      "planner_opened",
    ]) {
      expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain(name);
    }
  });

  it("strips names, wishlists, recipes, emails, and tokens from analytics metadata", () => {
    const clean = sanitizePlannerAnalyticsMetadata({
      applePay: true,
      wishlist: "secret list",
      recipe: "geese",
      email: "a@b.com",
      public_token: "abc",
      names: "The Smiths",
      addons: ["addon_recipes"],
    });
    expect(clean.applePay).toBe(true);
    expect(clean.wishlist).toBeUndefined();
    expect(clean.recipe).toBeUndefined();
    expect(clean.email).toBeUndefined();
    expect(clean.public_token).toBeUndefined();
    expect(clean.names).toBeUndefined();
    const session = newFunnelUuid();
    const validated = validateChristmasFunnelIngestPayload({
      event_name: "planner_purchase",
      funnel_session_id: session,
      product_key: PLANNER_PRODUCT_KEY,
      package_key: "all_in",
      amount_cents: 4900,
      metadata: { email: "leak@example.com", wishlist: "nope", applePay: true },
    });
    expect(validated.metadata.email).toBeUndefined();
    expect(validated.metadata.wishlist).toBeUndefined();
    expect(validated.utmSource).toBeNull();
    expect(plannerPurchaseEventId("11111111-1111-4111-8111-111111111111")).toContain("xmas_planner_purchase_");
  });
});

describe("christmas planner wiring", () => {
  it("registers routes, checkout branch, entitlements SQL, and SEO", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/christmas/planner"');
    expect(app).toContain('path="/christmas/planner/welcome"');
    expect(app).toContain('path="christmas"');
    expect(readSrc("supabase/functions/christmas-checkout/index.ts")).toContain("resolvePlannerCheckoutFromRows");
    expect(readSrc("supabase/functions/christmas-checkout/index.ts")).toContain("void body.amount_cents");
    expect(readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts")).toContain(
      "grant_christmas_planner_entitlements",
    );
    const sql = readSrc("supabase/migrations/20260917140000_christmas_planner_funnel.sql");
    expect(sql).toContain("create table if not exists public.user_entitlements");
    expect(sql).toContain("claim_christmas_planner_order");
    expect(sql).not.toContain("pet_orders_sku_chk");
    expect(christmasSitemapPaths()).toContain("/christmas/planner");
    expect(getChristmasSeo("/christmas/planner")?.title).toMatch(/Christmas Planner/i);
    expect(findProduct(CHRISTMAS_CATALOG_SEED, PLANNER_PRODUCT_KEY)?.routePath).toBe("/christmas/planner");
  });

  it("keeps Apple Pay / Google Pay on ExpressCheckoutElement capability callbacks", () => {
    const checkout = readSrc("src/features/pet/components/CustomStripeCheckout.tsx");
    expect(checkout).toContain("ExpressCheckoutElement");
    expect(checkout).toContain("availablePaymentMethods");
    expect(checkout).toContain("applePay");
    expect(checkout).toContain("googlePay");
    expect(readSrc("src/features/christmas/planner/ChristmasPlannerPage.tsx")).toContain("onWalletAvailability");
  });

  it("does not invent testimonials", () => {
    const page = readSrc("src/features/christmas/planner/ChristmasPlannerPage.tsx");
    expect(page).toContain("New for Christmas 2026");
    expect(page.toLowerCase()).not.toContain("5,000 happy customers");
    expect(page.toLowerCase()).not.toContain("rated 4.9");
  });
});
