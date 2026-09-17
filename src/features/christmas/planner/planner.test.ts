import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_CATALOG_SEED } from "../catalog";
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
import {
  christmasDayParts,
  countdownCopy,
  daysUntilChristmas,
  resolvePlanMode,
  upcomingChristmasYear,
} from "./date";
import {
  accessFromGrants,
  addonIncludedInPackage,
  canAddRecipient,
  featuresForPackage,
  featuresFromFunnelEntitlementKeys,
  hasFeature,
} from "./entitlements";
import {
  accessForSeason,
  applyOrderGrant,
  claimGrants,
  grantsForPaidOrder,
  revokeOrder,
} from "./entitlementEngine";
import { generateInitialPlan, recommendedToday } from "./planGenerator";
import { computeReadiness } from "./readiness";
import { answerFromContext } from "./assistant";
import { sanitizePlannerMetadata } from "./analytics";
import { FREE_LIMITS } from "./types";

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
    expect(app).toContain("PlannerAwareSupportWidget");
    expect(app).toContain('path="/christmas/planner/welcome"');
    expect(app).toContain('path="/account/christmas"');
    expect(app).toContain("ChristmasPlannerLayout");
    expect(app).toContain("ChristmasPlannerPage");
    expect(app).not.toContain("ChristmasPlannerPublicPage");
    expect(app).not.toContain("AccountChristmasPage");
    expect(readSrc("supabase/functions/christmas-checkout/index.ts")).toContain("resolvePlannerCheckoutFromRows");
    expect(readSrc("supabase/functions/christmas-checkout/index.ts")).toContain("void body.amount_cents");
    expect(readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts")).toContain(
      "grant_christmas_planner_entitlements",
    );
    expect(readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts")).toContain(
      "refund_christmas_planner_order",
    );
    const sql = readSrc("supabase/migrations/20260917140000_christmas_planner_funnel.sql");
    expect(sql).toContain("create table if not exists public.user_entitlements");
    expect(sql).toContain("claim_christmas_planner_order");
    expect(sql).not.toContain("pet_orders_sku_chk");
    const workspace = readSrc("supabase/migrations/20260917180000_christmas_planner_workspace.sql");
    expect(workspace).toContain("christmas_planner_profiles");
    expect(workspace).toContain("get_christmas_planner_access");
    expect(workspace).toContain("map_planner_entitlement_to_features");
    expect(workspace).toContain("revoke_christmas_planner_entitlements");
    expect(workspace).toContain("user_entitlements");
    expect(workspace).not.toContain("grant_christmas_planner_entitlements(p_order_id uuid)");
    expect(christmasSitemapPaths()).toContain("/christmas/planner");
    expect(getChristmasSeo("/christmas/planner")?.title).toMatch(/Christmas Planner/i);
    expect(readSrc("src/pages/admin/ChristmasOrders.tsx")).toContain("Grant entitlement");
    expect(readSrc("src/pages/admin/ChristmasOrders.tsx")).toContain("adminRevoke");
  });

  it("namespaces account app CSS away from editorial funnel CSS", () => {
    const layout = readSrc("src/features/christmas/planner/ChristmasPlannerLayout.tsx");
    const appCss = readSrc("src/features/christmas/planner/plannerApp.css");
    const funnelCss = readSrc("src/features/christmas/planner/planner.css");
    expect(layout).toContain("tdg-planner-app");
    expect(layout).toContain("plannerApp.css");
    expect(appCss).toContain(".tdg-planner-app");
    expect(funnelCss).toContain("--parchment");
    expect(funnelCss).not.toContain(".tdg-planner-app");
  });

  it("keeps Apple Pay / Google Pay on ExpressCheckoutElement capability callbacks", () => {
    const checkout = readSrc("src/features/pet/components/CustomStripeCheckout.tsx");
    expect(checkout).toContain("ExpressCheckoutElement");
    expect(checkout).toContain("availablePaymentMethods");
    expect(checkout).toContain("applePay");
    expect(checkout).toContain("googlePay");
    expect(readSrc("src/features/christmas/planner/ChristmasPlannerPage.tsx")).toContain("onWalletAvailability");
    expect(readSrc("src/features/christmas/planner/ChristmasPlannerPage.tsx")).toContain("walletCapabilityOnly");
    expect(checkout).toContain("walletCapabilityOnly");
    expect(checkout).toContain('applePay: "auto" as const');
    expect(checkout).toContain('googlePay: "auto" as const');
  });

  it("does not duplicate the English planner on locale-prefixed Christmas routes", () => {
    const app = readSrc("src/App.tsx");
    const localeBlock = app.slice(app.lastIndexOf("christmasLocalePrefixedRoutes(prefix"));
    expect(localeBlock).not.toContain('path="/christmas/planner"');
  });

  it("does not invent testimonials", () => {
    const page = readSrc("src/features/christmas/planner/ChristmasPlannerPage.tsx");
    expect(page).toContain("New for Christmas 2026");
    expect(page).toContain("catalog.checkoutLive");
    expect(page.toLowerCase()).not.toContain("5,000 happy customers");
    expect(page.toLowerCase()).not.toContain("rated 4.9");
  });

  it("uses editorial story sections instead of a SaaS card-grid hero", () => {
    const page = readSrc("src/features/christmas/planner/ChristmasPlannerPage.tsx");
    const css = readSrc("src/features/christmas/planner/planner.css");
    expect(page).toContain("Your entire Christmas,");
    expect(page).toContain("beautifully planned.");
    expect(page).toContain("tdg-planner__pulse");
    expect(page).toContain("Christmas shouldn’t feel like project management.");
    expect(page).toContain("Christmas Rescue Mode");
    expect(page).not.toContain("Preview mock");
    expect(page).not.toContain("tdg-planner__mock");
    expect(css).toContain("--parchment");
    expect(css).toContain("tdg-planner__pulse");
    expect(css).not.toContain("tdg-planner__mock");
  });
});

describe("christmas planner season dates", () => {
  it("uses 2026 Christmas from September", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    expect(upcomingChristmasYear(now, "UTC")).toBe(2026);
    expect(daysUntilChristmas(now, "UTC")).toBe(99);
    expect(resolvePlanMode(99, "starting")).toBe("early");
    expect(countdownCopy(99)).toContain("99 days");
  });

  it("switches to 5–8 week plan in November", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(daysUntilChristmas(now, "UTC")).toBe(45);
    expect(resolvePlanMode(45, "some")).toBe("standard");
  });

  it("uses rescue near Christmas and wrap after the 25th", () => {
    expect(daysUntilChristmas(new Date("2026-12-18T12:00:00Z"), "UTC")).toBe(7);
    expect(resolvePlanMode(7, "starting")).toBe("rescue");
    expect(upcomingChristmasYear(new Date("2026-12-24T12:00:00Z"), "UTC")).toBe(2026);
    expect(upcomingChristmasYear(new Date("2026-12-25T12:00:00Z"), "UTC")).toBe(2026);
    expect(upcomingChristmasYear(new Date("2026-12-26T12:00:00Z"), "UTC")).toBe(2027);
    expect(resolvePlanMode(-1, "mostly")).toBe("wrap");
  });
});

describe("dynamic plan templates", () => {
  it("builds a hosting+travel+kids early plan with system origin", () => {
    const tasks = generateInitialPlan({
      today: { year: 2026, month: 9, day: 17 },
      christmas: christmasDayParts(2026),
      mode: "early",
      hosting: true,
      travelling: true,
      hasChildren: true,
      giftCount: 6,
      prepared: "starting",
    });
    expect(tasks.length).toBeGreaterThan(8);
    expect(tasks.every((t) => t.origin === "system")).toBe(true);
    expect(tasks.some((t) => t.template_key === "menu_draft")).toBe(true);
    expect(tasks.some((t) => t.template_key === "travel_book")).toBe(true);
    expect(tasks.some((t) => t.template_key === "kids_photos")).toBe(true);
  });

  it("omits hosting tasks when not hosting", () => {
    const tasks = generateInitialPlan({
      today: { year: 2026, month: 12, day: 18 },
      christmas: christmasDayParts(2026),
      mode: "rescue",
      hosting: false,
      travelling: false,
      hasChildren: false,
      giftCount: 2,
      prepared: "rescue",
    });
    expect(tasks.some((t) => t.template_key === "menu_draft")).toBe(false);
    expect(tasks.some((t) => t.template_key === "rescue_today")).toBe(true);
  });

  it("recommends overdue tasks first", () => {
    const rec = recommendedToday(
      [
        { due_on: "2026-12-24", status: "open", priority: "low" },
        { due_on: "2026-09-01", status: "open", priority: "normal" },
        { due_on: "2026-12-20", status: "done", priority: "high" },
      ],
      "2026-09-17",
      3,
    );
    expect(rec[0]?.due_on).toBe("2026-09-01");
  });
});

describe("entitlements are feature-mapped, not isPremium", () => {
  it("maps packages to feature keys", () => {
    expect(featuresForPackage("christmas_planner_2026", "essentials")).toContain("planner_core");
    expect(featuresForPackage("christmas_planner_2026", "magic")).toContain("food_planner");
    expect(featuresForPackage("christmas_planner_2026", "all_in")).toContain("premium_content");
  });

  it("maps funnel user_entitlements keys to V1 feature flags", () => {
    const features = featuresFromFunnelEntitlementKeys([
      "planner.countdown",
      "planner.gifts",
      "planner.budget",
      "planner.meals",
      "planner.rescue_mode",
    ]);
    expect(features).toContain("planner_core");
    expect(features).toContain("gift_planner");
    expect(features).toContain("budget");
    expect(features).toContain("food_planner");
    expect(features).toContain("rescue_mode");
  });

  it("revokes access when grants are revoked", () => {
    let grants = grantsForPaidOrder({
      orderId: "o1",
      productKey: "christmas_planner_2026",
      packageKey: "essentials",
      seasonYear: 2026,
      userId: "u1",
      email: "a@b.com",
      paymentStatus: "paid",
    });
    expect(accessForSeason(grants, "u1", 2026).paid).toBe(true);
    grants = revokeOrder(grants, "o1");
    expect(accessForSeason(grants, "u1", 2026).paid).toBe(false);
  });

  it("claims guest grants only for verified matching email", () => {
    const grants = [
      {
        orderId: "o1",
        featureKey: "planner_core" as const,
        seasonYear: 2026,
        status: "active" as const,
        userId: null,
        email: "owner@example.com",
      },
    ];
    const denied = claimGrants({
      grants,
      actorUserId: "u2",
      actorEmail: "owner@example.com",
      verified: false,
      orders: [{ orderId: "o1", userId: null, email: "owner@example.com" }],
    });
    expect(denied.claimedOrderIds).toEqual([]);
    const ok = claimGrants({
      grants,
      actorUserId: "u2",
      actorEmail: "owner@example.com",
      verified: true,
      orders: [{ orderId: "o1", userId: null, email: "owner@example.com" }],
    });
    expect(ok.claimedOrderIds).toEqual(["o1"]);
    expect(ok.grants[0]?.userId).toBe("u2");
  });

  it("enforces free recipient limits without gift_planner", () => {
    const free = accessFromGrants({ grantKeys: [], seasonYear: 2026 });
    expect(canAddRecipient(free, FREE_LIMITS.maxRecipients).ok).toBe(false);
    const paid = accessFromGrants({ grantKeys: ["gift_planner"], seasonYear: 2026 });
    expect(canAddRecipient(paid, 99).ok).toBe(true);
    expect(hasFeature(paid, "gift_planner")).toBe(true);
  });

  it("treats food add-on features as included in magic", () => {
    expect(addonIncludedInPackage("magic", "food")).toBe(true);
    expect(addonIncludedInPackage("essentials", "food")).toBe(false);
  });
});

describe("readiness is explainable", () => {
  it("starts low and rises with weighted modules", () => {
    const empty = computeReadiness({
      profile: { hosting: false, travelling: false, total_budget_minor: null, onboarding_completed_at: "x" },
      tasks: [{ status: "open", category: "gifts" }],
      recipients: [],
      gifts: [],
    });
    expect(empty.percent).toBeLessThan(20);
    expect(empty.parts.some((p) => p.key === "tasks")).toBe(true);

    const better = computeReadiness({
      profile: { hosting: true, travelling: false, total_budget_minor: 80000, onboarding_completed_at: "x" },
      tasks: [
        { status: "done", category: "gifts" },
        { status: "done", category: "food" },
      ],
      recipients: [{ id: "a" }],
      gifts: [{ recipient_id: "a", status: "ordered" }],
      mealsCount: 2,
      cardsNeeded: 1,
      cardsPrepared: 1,
    });
    expect(better.percent).toBeGreaterThan(80);
    expect(better.parts.find((p) => p.key === "meals")).toBeTruthy();
  });
});

describe("privacy-safe planner analytics + assistant", () => {
  it("strips names, notes, and budgets from event metadata", () => {
    const clean = sanitizePlannerMetadata({
      module: "gifts",
      display_name: "Dad",
      notes: "secret",
      budget: 800,
      count_bucket: "4-6",
    });
    expect(clean.module).toBe("gifts");
    expect(clean.count_bucket).toBe("4-6");
    expect(clean.display_name).toBeUndefined();
    expect(clean.notes).toBeUndefined();
    expect(clean.budget).toBeUndefined();
  });

  it("answers from counts without sending notes", () => {
    const reply = answerFromContext("What am I forgetting?", {
      daysLeft: 20,
      planMode: "standard",
      readinessPercent: 40,
      openTasks: 6,
      recipientCount: 4,
      giftsWithoutPlan: 2,
      budgetRemainingMinor: 12000,
      currency: "eur",
      hosting: true,
    });
    expect(reply.source).toBe("local_rules");
    expect(reply.text.toLowerCase()).toContain("gift");
  });
});

describe("planner entitlement invariants", () => {
  it("does not double-grant the same order feature", () => {
    const base = grantsForPaidOrder({
      orderId: "o1",
      productKey: "christmas_planner_2026",
      packageKey: "essentials",
      seasonYear: 2026,
      userId: "u1",
      email: "a@b.com",
      paymentStatus: "paid",
    });
    let grants = base;
    for (const g of base) {
      grants = applyOrderGrant(grants, g);
    }
    expect(grants.length).toBe(base.length);
  });
});
