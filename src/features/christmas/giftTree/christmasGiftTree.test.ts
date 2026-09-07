import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHRISTMAS_CATALOG_SEED,
  ctaStateForProduct,
  findProduct,
  resolvePurchasableOffer,
} from "../catalog";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "../funnelEventContract";
import { shellForPath } from "../routes";
import { planChristmasCheckout } from "../checkout";
import {
  applyPaidGrant,
  consumeOpen,
  decideOpenKind,
  denyOpenCopy,
  filterOpenableRewards,
  freeOpenIdempotencyKey,
  GIFT_TREE_PRODUCT_KEY,
  GIFT_TREE_ROUTE,
  grantIdempotencyKey,
  opensForPackage,
  publicRewardView,
  remainingOpens,
  sanitizeGiftTreeAnalytics,
  weightedPickReward,
  type GiftTreeRewardCandidate,
} from "./giftTreeLogic";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const catalogReward = (
  partial: Partial<GiftTreeRewardCandidate> & Pick<GiftTreeRewardCandidate, "id" | "reward_key">,
): GiftTreeRewardCandidate => ({
  reward_type: "surprise_message",
  title: "Holiday Cheer",
  description: "A note",
  weight: 5,
  reward_value: 0,
  active: true,
  paid_only: false,
  guest_allowed: true,
  ...partial,
});

describe("christmas gift tree catalog", () => {
  it("is a distinct open experience at /christmas/gifts", () => {
    const product = findProduct(CHRISTMAS_CATALOG_SEED, GIFT_TREE_PRODUCT_KEY);
    expect(product?.routePath).toBe(GIFT_TREE_ROUTE);
    expect(product?.productType).toBe("gift_tree");
    expect(product?.packages.map((pkg) => pkg.packageKey)).toEqual(["open_1", "open_3", "open_5"]);
    expect(product?.packages.every((pkg) => pkg.purchasable === false)).toBe(true);
    expect(ctaStateForProduct(product!)).toBe("open");
    expect(shellForPath(GIFT_TREE_ROUTE)).toBeNull();
  });

  it("does not collide with the shareable tree product", () => {
    const tree = findProduct(CHRISTMAS_CATALOG_SEED, "christmas_tree");
    const gifts = findProduct(CHRISTMAS_CATALOG_SEED, GIFT_TREE_PRODUCT_KEY);
    expect(tree?.routePath).toBe("/christmas/tree");
    expect(gifts?.routePath).toBe("/christmas/gifts");
    expect(tree?.productKey).not.toBe(gifts?.productKey);
  });

  it("ignores client-supplied pack prices", () => {
    const catalog = CHRISTMAS_CATALOG_SEED.map((product) => {
      if (product.productKey !== GIFT_TREE_PRODUCT_KEY) return product;
      return {
        ...product,
        packages: product.packages.map((pkg) =>
          pkg.packageKey === "open_3" ? { ...pkg, purchasable: true, priceCents: 900 } : pkg,
        ),
      };
    });
    const resolved = resolvePurchasableOffer({
      catalog,
      productKey: GIFT_TREE_PRODUCT_KEY,
      packageKey: "open_3",
      clientAmountCents: 1,
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.amountCents).toBe(900);
  });
});

describe("christmas gift tree chance math", () => {
  it("maps Stripe packs to server open counts", () => {
    expect(opensForPackage("open_1")).toBe(1);
    expect(opensForPackage("open_3")).toBe(3);
    expect(opensForPackage("open_5")).toBe(5);
    expect(opensForPackage("not_a_pack")).toBeNull();
  });

  it("scopes free vs paid opens and never invents leftover balance", () => {
    const empty = { freeOpensUsed: 0, paidOpensRemaining: 0, paidOpensGranted: 0 };
    expect(decideOpenKind({ hasIdentity: true, opensEnabled: true, account: empty })).toEqual({
      ok: true,
      kind: "free",
    });
    const usedFree = consumeOpen(empty, "free");
    if ("ok" in usedFree) throw new Error("expected consume");
    expect(usedFree.freeOpensUsed).toBe(1);
    expect(remainingOpens(usedFree)).toBe(0);
    expect(decideOpenKind({ hasIdentity: true, opensEnabled: true, account: usedFree })).toEqual({
      ok: false,
      code: "need_pack",
    });
    const granted = applyPaidGrant(usedFree, "open_3");
    if ("ok" in granted) throw new Error("expected grant");
    expect(granted.paidOpensRemaining).toBe(3);
    expect(granted.paidOpensGranted).toBe(3);
    expect(decideOpenKind({ hasIdentity: true, opensEnabled: false, account: granted })).toEqual({
      ok: true,
      kind: "paid",
    });
  });

  it("filters credits and paid-only rewards for guests / free opens", () => {
    const rewards = [
      catalogReward({ id: "1", reward_key: "cheer" }),
      catalogReward({
        id: "2",
        reward_key: "credit",
        reward_type: "credits",
        reward_value: 5,
        paid_only: true,
        guest_allowed: false,
      }),
    ];
    const guestFree = filterOpenableRewards({
      rewards,
      kind: "free",
      authenticated: false,
      creditsEnabled: true,
    });
    expect(guestFree.map((r) => r.reward_key)).toEqual(["cheer"]);
    const authedPaid = filterOpenableRewards({
      rewards,
      kind: "paid",
      authenticated: true,
      creditsEnabled: true,
    });
    expect(authedPaid.map((r) => r.reward_key)).toEqual(["cheer", "credit"]);
  });

  it("weighted pick is deterministic with a stub rng and never returns client titles", () => {
    const rewards = [
      catalogReward({ id: "1", reward_key: "a", weight: 1 }),
      catalogReward({ id: "2", reward_key: "b", weight: 99, title: "Server Bauble" }),
    ];
    const picked = weightedPickReward(rewards, () => 0.5);
    expect(picked?.reward_key).toBe("b");
    expect(publicRewardView(picked!).title).toBe("Server Bauble");
    expect(weightedPickReward([], () => 0.1)).toBeNull();
  });

  it("identity keys are scoped and grants are idempotent per order", () => {
    expect(
      freeOpenIdempotencyKey({
        seasonYear: 2026,
        userId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBe("gift_tree_free:2026:user:11111111-1111-4111-8111-111111111111");
    expect(grantIdempotencyKey("ord-1")).toBe("gift_tree_grant:ord-1");
    expect(sanitizeGiftTreeAnalytics({ guest_token: "secret", box_slot: 2 })).toEqual({
      box_slot: 2,
    });
    expect(denyOpenCopy("need_pack")).toMatch(/pack/i);
  });
});

describe("christmas gift tree wiring", () => {
  it("registers the live route before the SEO catch-all", () => {
    const app = readSrc("src/App.tsx");
    const gifts = app.indexOf('path="/christmas/gifts"');
    const seo = app.indexOf('path="/:pageType/:slug"');
    expect(gifts).toBeGreaterThan(-1);
    expect(seo).toBeGreaterThan(gifts);
    expect(app).toContain("ChristmasGiftTreePage");
    expect(app).toContain('path="/christmas/tree"');
  });

  it("migration is identity-scoped and additive", () => {
    const sql = readSrc("supabase/migrations/20260907220000_christmas_gift_tree.sql");
    expect(sql).toContain("christmas_gift_tree_rewards");
    expect(sql).toContain("christmas_gift_tree_accounts");
    expect(sql).toContain("christmas_gift_tree_opens");
    expect(sql).toContain("christmas_gift_tree_grants");
    expect(sql).toContain("christmas_gift_tree_accounts_user_season_uidx");
    expect(sql).toContain("christmas_gift_tree_accounts_guest_season_uidx");
    expect(sql).toContain("christmas_gift_tree_opens_free_user_uidx");
    expect(sql).toContain("christmas_gift_tree_grants_order_uidx");
    expect(sql).toContain("revoke all on table public.christmas_gift_tree_accounts from anon");
    expect(sql).toContain("'gift_tree'");
    expect(sql).toContain("purchasable");
    expect(sql).toContain("false");
    expect(sql).not.toContain("drop table public.christmas_trees");
    expect(sql).not.toContain("pet_orders_sku_chk");
  });

  it("edge funnel and webhook grant server rewards only", () => {
    const fn = readSrc("supabase/functions/christmas-gift-tree-funnel/index.ts");
    expect(fn).toContain('action === "status"');
    expect(fn).toContain('action === "openGift"');
    expect(fn).toContain("filterOpenableRewards");
    expect(fn).toContain("weightedPick");
    expect(fn).toContain("identity_required");
    expect(fn).not.toContain("client_reward");
    expect(fn).not.toContain("Math.random() * 100");

    const fulfill = readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts");
    expect(fulfill).toContain("grantPaidGiftTreeOpens");
    expect(fulfill).toContain("sendGiftTreePackEmail");
    expect(fulfill).toContain("GIFT_TREE_PRODUCT_KEY");

    const checkout = readSrc("supabase/functions/christmas-checkout/index.ts");
    expect(checkout).toContain("christmas_gift_tree");
    expect(checkout).toContain("gift_tree_guest_hash");
    expect(checkout).toContain("/christmas/gifts?checkout=success");
    expect(checkout).toContain("void body.amount_cents");
  });

  it("page never hardcodes a fake win and wires Apple Pay checkout", () => {
    const page = readSrc("src/features/christmas/ChristmasGiftTreePage.tsx");
    expect(page).toContain("CustomStripeCheckout");
    expect(page).toContain("giftTreeFunnel");
    expect(page).toContain("Server did not return a catalog reward");
    expect(page).not.toContain("You won $");
    expect(page).not.toContain("100 credits");
    expect(page).not.toContain("fake reward");
    expect(page).toContain("/christmas/tree");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("gift_tree_opened");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("gift_tree_pack_granted");
  });

  it("checkout plan still refuses gift-tree packs while kill switch / purchasable is off", () => {
    const prev = process.env.CHRISTMAS_CHECKOUT_ENABLED;
    process.env.CHRISTMAS_CHECKOUT_ENABLED = "true";
    const plan = planChristmasCheckout({
      catalog: CHRISTMAS_CATALOG_SEED,
      productKey: GIFT_TREE_PRODUCT_KEY,
      packageKey: "open_1",
      successUrl: "https://example.com/christmas/gifts",
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.code).toBe("not_purchasable");
    if (prev == null) delete process.env.CHRISTMAS_CHECKOUT_ENABLED;
    else process.env.CHRISTMAS_CHECKOUT_ENABLED = prev;
  });
});
