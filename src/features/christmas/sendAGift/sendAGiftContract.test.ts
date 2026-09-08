import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHRISTMAS_CATALOG_SEED,
  ctaStateForProduct,
  findProduct,
  hubProducts,
} from "../catalog";
import { SEND_A_GIFT_PACKAGE_KEYS, SEND_A_GIFT_PRODUCT_KEY } from "./packageComposition";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Send-a-Gift acceptance contract", () => {
  it("wires /send-a-gift and /gift/:shareId without touching /christmas/gifts", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/send-a-gift"');
    expect(app).toContain('path="/gift/:shareId"');
    expect(app).toContain("SendAGiftPage");
    expect(app).toContain("GiftRedeemPage");
    expect(app).not.toContain('path="/christmas/gifts"');
    expect(app).toContain('path="/christmas/tree/:shareId"');
  });

  it("seeds exactly 3 server packages with production_purchasable=false", () => {
    const product = findProduct(CHRISTMAS_CATALOG_SEED, SEND_A_GIFT_PRODUCT_KEY);
    expect(product?.routePath).toBe("/send-a-gift");
    expect(product?.metadata.production_purchasable).toBe(false);
    expect(product?.packages.map((p) => p.packageKey)).toEqual([...SEND_A_GIFT_PACKAGE_KEYS]);
    expect(product?.packages).toHaveLength(3);
    for (const pkg of product?.packages ?? []) {
      expect(pkg.purchasable).toBe(false);
      expect(pkg.priceCents).toBe(0);
      expect(pkg.metadata.production_purchasable).toBe(false);
    }
    expect(ctaStateForProduct(product!)).toBe("open");
    expect(hubProducts(CHRISTMAS_CATALOG_SEED).some((p) => p.productKey === SEND_A_GIFT_PRODUCT_KEY)).toBe(
      true,
    );
    expect(readSrc("src/pages/website/ChristmasPage.tsx")).toContain('"christmas_send_a_gift"');
  });

  it("defines exactly-once activate + redeem RPCs on service_role only", () => {
    const sql = readSrc("supabase/migrations/20260906010000_christmas_send_a_gift.sql");
    expect(sql).toContain("create or replace function public.activate_christmas_send_a_gift");
    expect(sql).toContain("create or replace function public.redeem_christmas_gift_entitlement");
    expect(sql).toContain("already_activated");
    expect(sql).toContain("already_redeemed");
    expect(sql).toContain("christmas_gift_shares_order_uidx");
    expect(sql).toContain("christmas_gift_redemptions_idempotency_uidx");
    expect(sql).toContain("grant execute on function public.activate_christmas_send_a_gift");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("revoke all on function public.activate_christmas_send_a_gift");
    expect(sql).toContain("'starter'");
    expect(sql).toContain("'classic'");
    expect(sql).toContain("'premium'");
    expect(sql).toContain("'production_purchasable', false");
  });

  it("activates prepaid gifts from Stripe fulfill without enqueueing photo generate", () => {
    const fulfill = readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts");
    expect(fulfill).toContain("activateSendAGiftAfterPaid");
    expect(fulfill).toContain("isSendAGiftProductKey");
    expect(fulfill).toContain("no portrait enqueue");
    expect(fulfill.indexOf("if (isSendAGiftProductKey(productKey))")).toBeLessThan(
      fulfill.indexOf("enqueueChristmasGenerate(orderId, mode)"),
    );
  });

  it("registers the send-a-gift edge function", () => {
    expect(readSrc("supabase/config.toml")).toContain("[functions.christmas-send-a-gift]");
    expect(readSrc("supabase/functions/christmas-send-a-gift/index.ts")).toContain('action === "getCatalog"');
    expect(readSrc("supabase/functions/christmas-send-a-gift/index.ts")).toContain('action === "redeem"');
    expect(readSrc("docs/TDG_SEND_A_GIFT.md")).toContain("production_purchasable=false");
  });
});
