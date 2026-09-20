import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHRISTMAS_CATALOG_SEED } from "../catalog";
import {
  PLANNER_PRODUCT_KEY,
  plannerCheckoutReturnPath,
  plannerPublicCatalog,
  resolvePlannerCheckout,
} from "./commerce";
import { hasFeature } from "./entitlements";
import {
  FOUNDING_PASS_CURRENCY,
  FOUNDING_PASS_PACKAGE_KEY,
  FOUNDING_PASS_PRICE_CENTS,
  FOUNDING_PASS_PRICE_LABEL,
} from "./types";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function liveCatalog() {
  return CHRISTMAS_CATALOG_SEED.map((product) =>
    product.productKey === PLANNER_PRODUCT_KEY
      ? { ...product, metadata: { ...product.metadata, checkout_live: true } }
      : product,
  );
}

describe("Founding Pass $17 checkout authority", () => {
  it("locks the public catalog to founding_pass at 1700 USD", () => {
    const product = CHRISTMAS_CATALOG_SEED.find((p) => p.productKey === PLANNER_PRODUCT_KEY)!;
    const founding = product.packages.find((pkg) => pkg.packageKey === FOUNDING_PASS_PACKAGE_KEY);
    expect(founding?.priceCents).toBe(FOUNDING_PASS_PRICE_CENTS);
    expect(founding?.currency).toBe(FOUNDING_PASS_CURRENCY);
    expect(founding?.purchasable).toBe(true);
    const publicCatalog = plannerPublicCatalog(product);
    expect(publicCatalog.packages).toHaveLength(1);
    expect(publicCatalog.packages[0]?.packageKey).toBe("founding_pass");
    expect(publicCatalog.packages[0]?.priceCents).toBe(1700);
    expect(readSrc("supabase/functions/christmas-checkout/index.ts")).toContain(
      "if (!isPlannerProductKey(productKey) && !checkoutEnabled())",
    );
    expect(publicCatalog.packages.some((pkg) => pkg.priceCents === 1299)).toBe(false);
    expect(FOUNDING_PASS_PRICE_LABEL).toBe("$17");
  });

  it("ignores a client-supplied amount and never accepts a browser price id", () => {
    const prev = process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED;
    process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED = "true";
    const plan = resolvePlannerCheckout({
      catalog: liveCatalog(),
      packageKey: "founding_pass",
      clientAmountCents: 1299,
      clientCurrency: "eur",
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.amountCents).toBe(1700);
      expect(plan.currency).toBe("usd");
      expect(plan.packageKey).toBe("founding_pass");
    }
    const checkout = readSrc("supabase/functions/christmas-checkout/index.ts");
    expect(checkout).toContain("void body.amount_cents");
    expect(checkout).toContain("price_id");
    expect(checkout).toContain("stripe_price_id");
    expect(checkout).not.toContain("params.set(\"line_items[0][price]\"");
    if (prev == null) delete process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED;
    else process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED = prev;
  });

  it("rejects a Founding Pass row that is not $17 USD", () => {
    process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED = "true";
    const catalog = liveCatalog().map((product) => {
      if (product.productKey !== PLANNER_PRODUCT_KEY) return product;
      return {
        ...product,
        packages: product.packages.map((pkg) =>
          pkg.packageKey === "founding_pass" ? { ...pkg, priceCents: 1299 } : pkg,
        ),
      };
    });
    const plan = resolvePlannerCheckout({ catalog, packageKey: "founding_pass", clientAmountCents: 1700 });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.code).toBe("invalid_price");
  });

  it("does not sell legacy essentials at $12.99", () => {
    process.env.CHRISTMAS_PLANNER_CHECKOUT_ENABLED = "true";
    const plan = resolvePlannerCheckout({
      catalog: liveCatalog(),
      packageKey: "essentials",
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.code).toBe("not_purchasable");
  });
});

describe("Founding Pass unlock CTA", () => {
  it("starts checkout directly from the CTA without a marketing modal", () => {
    const unlock = readSrc("src/features/christmas/planner/FoundingPassUnlock.tsx");
    const api = readSrc("src/features/christmas/planner/api.ts");
    const photoApi = readSrc("src/features/christmas/photoApi.ts");
    expect(unlock).toContain("onClick={() => void startPay()}");
    expect(unlock).toContain("startPlannerCheckout");
    expect(unlock).toContain("Starting checkout…");
    expect(unlock).toContain("inflight.current");
    expect(unlock).toContain("CustomStripeCheckout");
    expect(unlock).toContain("walletCapabilityOnly");
    expect(unlock).not.toContain("FoundingPassOfferSheet");
    expect(unlock).not.toContain("CHECKOUT_SOON");
    expect(unlock).not.toContain("opening soon");
    expect(unlock).not.toContain("checkout stays off");
    expect(unlock).not.toContain("12.99");
    expect(unlock).not.toContain("12,99");
    expect(unlock).toContain('data-testid="planner-checkout-error"');
    expect(api).toContain("plannerCheckoutReturnPath");
    expect(api).toContain("success_url: `${origin}${returnPath}?checkout=success`");
    expect(photoApi).toContain("christmasCheckoutInflight");
  });

  it("preserves the locked module as the success return route", () => {
    expect(plannerCheckoutReturnPath("/account/christmas/food")).toBe("/account/christmas/food");
    expect(plannerCheckoutReturnPath("/account/christmas/budget")).toBe("/account/christmas/budget");
    expect(plannerCheckoutReturnPath("/account/christmas/gifts")).toBe("/account/christmas/gifts");
    expect(plannerCheckoutReturnPath("/account/christmas/recipes")).toBe("/account/christmas/recipes");
    expect(plannerCheckoutReturnPath("/account/christmas/grocery")).toBe("/account/christmas/grocery");
    expect(plannerCheckoutReturnPath("/account/christmas/calendar")).toBe("/account/christmas/calendar");
    expect(plannerCheckoutReturnPath("https://evil.example/account/christmas/food")).toBe(
      "/christmas/planner/welcome",
    );
    expect(plannerCheckoutReturnPath("//evil.com")).toBe("/christmas/planner/welcome");
    const layout = readSrc("src/features/christmas/planner/ChristmasPlannerLayout.tsx");
    expect(layout).toContain('params.get("checkout") !== "success"');
    expect(layout).toContain("claimPlannerOrder");
    expect(layout).toContain("reload()");
    const edge = readSrc("supabase/functions/_shared/christmas/plannerCommerce.ts");
    expect(edge).toContain("plannerSafeCheckoutSuccessUrl");
    expect(readSrc("supabase/functions/christmas-checkout/index.ts")).toContain("plannerSafeCheckoutSuccessUrl");
  });

  it("hides the Unlock CTA once Founding Pass features are entitled", () => {
    const entitled = {
      ok: true,
      season_year: 2026,
      features: ["food_planner", "budget", "recipes", "gift_planner"] as const,
      package_keys: ["founding_pass"],
      paid: true,
    };
    expect(hasFeature(entitled, "food_planner")).toBe(true);
    expect(hasFeature(entitled, "budget")).toBe(true);
    const food = readSrc("src/features/christmas/planner/food/FoodPages.tsx");
    const budget = readSrc("src/features/christmas/planner/BudgetPage.tsx");
    expect(food).toContain('if (!hasFeature(access, "food_planner"))');
    expect(budget).toContain("const entitled = hasFeature(access, \"budget\")");
    expect(budget).toContain("{!entitled ? (");
    expect(readSrc("src/features/christmas/planner/Onboarding.tsx")).toContain("fetchPlannerAccess");
    expect(readSrc("src/features/christmas/planner/api.ts")).toContain("get_christmas_planner_access");
  });

  it("keeps Apple Pay on Stripe capability callbacks and does not fake a wallet button", () => {
    const checkout = readSrc("src/features/pet/components/CustomStripeCheckout.tsx");
    expect(checkout).toContain("walletCapabilityOnly");
    expect(checkout).toContain('applePay: "auto" as const');
    expect(checkout).toContain("availablePaymentMethods");
    expect(checkout).toContain("walletCapabilityOnly ? null : <ApplePayButton disabled />");
    expect(readSrc("supabase/functions/christmas-checkout/index.ts")).toContain(
      "Do not set payment_method_types",
    );
  });

  it("grants Founding Pass entitlements only after verified Stripe fulfillment", () => {
    const fulfill = readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts");
    expect(fulfill).toContain("fulfill_christmas_order_payment");
    expect(fulfill).toContain("grant_christmas_planner_entitlements");
    expect(fulfill).toContain('p_source: "stripe"');
    expect(readSrc("supabase/migrations/20260920210000_founding_pass_price_lock.sql")).toContain("price_cents = 1700");
  });
});
