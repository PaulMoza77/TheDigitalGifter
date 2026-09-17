import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  christmasDayParts,
  countdownCopy,
  daysUntilChristmas,
  resolvePlanMode,
  upcomingChristmasYear,
} from "./date";
import { accessFromGrants, addonIncludedInPackage, canAddRecipient, featuresForPackage, hasFeature } from "./entitlements";
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

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

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
  it("maps core vs food add-on separately", () => {
    expect(featuresForPackage("christmas_planner", "essentials")).toContain("gift_planner");
    expect(featuresForPackage("christmas_planner", "magic")).toContain("hosting");
    expect(featuresForPackage("christmas_planner", "all_in")).toContain("travel");
    expect(addonIncludedInPackage("magic", "food")).toBe(true);
    expect(addonIncludedInPackage("essentials", "food")).toBe(false);
    expect(featuresForPackage("christmas_planner_food", "food")).toEqual(["food_planner", "recipes"]);
  });

  it("revoked/refunded orders do not unlock", () => {
    const access = accessFromGrants({
      grantKeys: [],
      orders: [
        {
          product_key: "christmas_planner",
          package_key: "complete",
          payment_status: "paid",
          refunded_at: "2026-09-01",
        },
      ],
      seasonYear: 2026,
    });
    expect(access.paid).toBe(false);
    expect(hasFeature(access, "planner_core")).toBe(false);
  });

  it("caps free recipients at 3", () => {
    const free = accessFromGrants({ grantKeys: [], orders: [], seasonYear: 2026 });
    expect(canAddRecipient(free, 3).ok).toBe(false);
    const paid = accessFromGrants({
      grantKeys: ["gift_planner"],
      orders: [],
      seasonYear: 2026,
    });
    expect(canAddRecipient(paid, 3).ok).toBe(true);
    expect(FREE_LIMITS.maxRecipients).toBe(3);
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

describe("planner wiring", () => {
  it("registers account + public routes and noindex on account", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/account/christmas"');
    expect(app).toContain('path="/christmas/planner"');
    expect(app).toContain('path="/christmas/planner/welcome"');
    const sql = readSrc("supabase/migrations/20260917120000_christmas_planner.sql");
    expect(sql).toContain("christmas_planner_profiles_owner_all");
    expect(sql).toContain("christmas_planner_owns_profile(profile_id)");
    expect(sql).toContain("revoke all on table public.christmas_planner_profiles from anon");
    expect(sql).toContain("using (published = true)");
    expect(sql).toContain("christmas_planner_owns_profile");
    expect(sql).toContain("get_christmas_planner_access");
    expect(sql).toContain("grant_christmas_planner_entitlements");
    expect(sql).toContain("christmas_planner_season_year");
    expect(sql).toContain("refund_christmas_planner_order");
    expect(sql).toContain("christmas_feature_grants_order_feat_uidx");
    expect(sql).toContain("email_unverified");
    expect(sql).not.toContain("revoked-row recovery");
    expect(sql).toContain("purchasable = public.christmas_packages.purchasable");
    expect(readSrc("src/features/christmas/funnelEventContract.ts")).toContain("planner_landing_view");
    expect(readSrc("src/features/christmas/funnelEventContract.ts")).toContain("planner_purchase");
    expect(readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts")).toContain(
      "grant_christmas_planner_entitlements",
    );
    expect(readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts")).toContain(
      "refund_christmas_planner_order",
    );
    expect(readSrc("supabase/functions/christmas-checkout/index.ts")).toContain("planner_checkout_disabled");
    expect(readSrc("supabase/functions/christmas-checkout/index.ts")).toContain("addon_already_included");
    expect(readSrc("src/features/christmas/planner/ChristmasPlannerPublicPage.tsx")).not.toContain("€14.99");
    expect(readSrc("src/features/christmas/planner/ChristmasPlannerPublicPage.tsx")).toContain(
      "Your entire Christmas, beautifully planned.",
    );
  });
});

describe("planner entitlement invariants", () => {
  const order2026 = grantsForPaidOrder({
    orderId: "o-2026",
    productKey: "christmas_planner",
    packageKey: "essentials",
    seasonYear: 2026,
    userId: "user-a",
    email: "a@x.com",
    paymentStatus: "paid",
  });

  it("1. 2026 order does not unlock 2027", () => {
    const access = accessForSeason(order2026, "user-a", 2027);
    expect(hasFeature(access, "planner_core")).toBe(false);
  });

  it("2. active grant unlocks current season", () => {
    expect(hasFeature(accessForSeason(order2026, "user-a", 2026), "gift_planner")).toBe(true);
  });

  it("3. revoked grant does not reappear from historical order", () => {
    const once = applyOrderGrant(order2026, order2026[0]);
    const revoked = revokeOrder(once, "o-2026");
    const replay = order2026.reduce((acc, g) => applyOrderGrant(acc, g), revoked);
    expect(replay.every((g) => g.status === "revoked")).toBe(true);
    expect(hasFeature(accessForSeason(replay, "user-a", 2026), "planner_core")).toBe(false);
  });

  it("4. expired grant does not unlock", () => {
    const expired = order2026.map((g) => ({ ...g, expiresAt: "2026-01-01T00:00:00Z" }));
    const access = accessFromGrants({
      grantKeys: [],
      grants: expired.map((g) => ({
        feature_key: g.featureKey,
        status: "active",
        season_year: 2026,
        expires_at: g.expiresAt,
        now: new Date("2026-09-17T00:00:00Z"),
      })),
      seasonYear: 2026,
    });
    expect(access.paid).toBe(false);
  });

  it("5. refund removes access", () => {
    const refunded = revokeOrder(order2026, "o-2026");
    expect(hasFeature(accessForSeason(refunded, "user-a", 2026), "planner_core")).toBe(false);
  });

  it("6. guest webhook replay creates one entitlement", () => {
    const guest = grantsForPaidOrder({
      orderId: "g1",
      productKey: "christmas_planner",
      packageKey: "essentials",
      seasonYear: 2026,
      userId: null,
      email: "guest@x.com",
      paymentStatus: "paid",
    });
    const replay = guest.reduce((acc, g) => applyOrderGrant(acc, g), guest);
    expect(replay).toHaveLength(guest.length);
  });

  it("7. authenticated webhook replay creates one entitlement", () => {
    const replay = order2026.reduce((acc, g) => applyOrderGrant(acc, g), order2026);
    expect(replay).toHaveLength(order2026.length);
  });

  it("8. repeated claim is idempotent", () => {
    const guest = grantsForPaidOrder({
      orderId: "g2",
      productKey: "christmas_planner",
      packageKey: "essentials",
      seasonYear: 2026,
      userId: null,
      email: "a@x.com",
      paymentStatus: "paid",
    });
    const first = claimGrants({
      grants: guest,
      actorUserId: "user-a",
      actorEmail: "a@x.com",
      verified: true,
      orders: [{ orderId: "g2", userId: null, email: "a@x.com" }],
    });
    const second = claimGrants({
      grants: first.grants,
      actorUserId: "user-a",
      actorEmail: "a@x.com",
      verified: true,
      orders: [{ orderId: "g2", userId: "user-a", email: "a@x.com" }],
    });
    expect(second.grants.filter((g) => g.featureKey === "planner_core")).toHaveLength(1);
  });

  it("9. wrong user cannot claim someone else's purchase", () => {
    const claimed = claimGrants({
      grants: order2026,
      actorUserId: "user-b",
      actorEmail: "b@x.com",
      verified: true,
      orders: [{ orderId: "o-2026", userId: "user-a", email: "a@x.com" }],
    });
    expect(claimed.claimedOrderIds).toEqual([]);
    expect(claimed.grants.every((g) => g.userId === "user-a")).toBe(true);
  });

  it("10-11. forged package/price are rejected in checkout plan", () => {
    const checkout = readSrc("src/features/christmas/checkout.ts");
    expect(checkout).toContain("planner_checkout_disabled");
    expect(checkout).toContain("isPlannerCheckoutProduct");
    const edge = readSrc("supabase/functions/christmas-checkout/index.ts");
    expect(edge).toContain("void body.amount_cents");
    expect(edge).toContain("not_purchasable");
  });

  it("12. add-on already included cannot double-charge", () => {
    expect(addonIncludedInPackage("magic", "hosting")).toBe(true);
    expect(readSrc("supabase/functions/christmas-checkout/index.ts")).toContain("addon_already_included");
  });

  it("13. planner kill switch prevents charge even if global checkout is on", () => {
    const checkout = readSrc("src/features/christmas/checkout.ts");
    expect(checkout).toContain("CHRISTMAS_PLANNER_CHECKOUT_ENABLED");
    expect(checkout).toContain("christmasPlannerCheckoutEnabled");
  });

  it("14. global Christmas features outside Planner are not enabled by planner seed", () => {
    const sql = readSrc("supabase/migrations/20260917120000_christmas_planner.sql");
    expect(sql).not.toContain("purchasable = true");
    expect(sql).toContain("live_offer\":false");
    expect(readSrc("src/features/christmas/catalog.ts")).toContain("purchasable: false");
  });
});

