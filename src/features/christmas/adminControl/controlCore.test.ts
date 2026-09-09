import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildChristmasControlSnapshot,
  CHRISTMAS_CONTROL_PATH,
  CHRISTMAS_CONTROL_PRIMARY_LINKS,
  CHRISTMAS_FUNNELS_HASH,
  CHRISTMAS_ORDERS_PATH,
  CHRISTMAS_SEND_A_GIFT_PATH,
  incrementCount,
  isChristmasControlEmpty,
  isSendAGiftProductKey,
  type ControlFunnelRow,
  type ControlOrderRow,
  type ControlPackageRow,
  type ControlProductRow,
} from "./controlCore";
import {
  assertChristmasControlSelectSafe,
  CHRISTMAS_CONTROL_FORBIDDEN_SELECT_FIELDS,
  CHRISTMAS_CONTROL_FUNNEL_SELECT,
  CHRISTMAS_CONTROL_ORDER_SELECT,
  CHRISTMAS_CONTROL_PACKAGE_SELECT,
  CHRISTMAS_CONTROL_PRODUCT_SELECT,
} from "./controlSelect";

function readSrc(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), "utf8");
}

function order(partial: Partial<ControlOrderRow> & Pick<ControlOrderRow, "id" | "product_key">): ControlOrderRow {
  return {
    package_key: "single",
    payment_status: "paid",
    fulfillment_status: "completed",
    created_at: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

function event(
  partial: Partial<ControlFunnelRow> & Pick<ControlFunnelRow, "funnel_session_id" | "product_key">,
): ControlFunnelRow {
  return {
    event_name: "christmas_page_view",
    created_at: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

describe("christmas control select privacy", () => {
  it("allowlists only non-PII columns", () => {
    for (const select of [
      CHRISTMAS_CONTROL_ORDER_SELECT,
      CHRISTMAS_CONTROL_FUNNEL_SELECT,
      CHRISTMAS_CONTROL_PRODUCT_SELECT,
      CHRISTMAS_CONTROL_PACKAGE_SELECT,
    ]) {
      expect(() => assertChristmasControlSelectSafe(select)).not.toThrow();
      for (const forbidden of CHRISTMAS_CONTROL_FORBIDDEN_SELECT_FIELDS) {
        expect(select.split(",").map((f) => f.trim())).not.toContain(forbidden);
      }
    }
  });

  it("rejects email and token columns", () => {
    expect(() => assertChristmasControlSelectSafe("id,email,product_key")).toThrow(/email/);
    expect(() => assertChristmasControlSelectSafe("public_token_hash,id")).toThrow(/public_token_hash/);
    expect(() => assertChristmasControlSelectSafe("metadata")).toThrow(/metadata/);
  });
});

describe("christmas control snapshot", () => {
  it("aggregates attention and per-product ops without inventing rows", () => {
    const orders: ControlOrderRow[] = [
      order({ id: "1", product_key: "christmas_photo", fulfillment_status: "failed" }),
      order({ id: "2", product_key: "christmas_photo", payment_status: "failed", fulfillment_status: "not_started" }),
      order({ id: "3", product_key: "christmas_send_a_gift", package_key: "classic", fulfillment_status: "queued" }),
    ];
    const events: ControlFunnelRow[] = [
      event({ funnel_session_id: "s1", product_key: "christmas_photo" }),
      event({ funnel_session_id: "s1", product_key: "christmas_photo", event_name: "checkout_started" }),
      event({ funnel_session_id: "s2", product_key: "christmas_send_a_gift" }),
    ];
    const products: ControlProductRow[] = [
      {
        id: "p-photo",
        product_key: "christmas_photo",
        active: true,
        public_discoverable: true,
        route_path: "/christmas/photo-generator",
      },
      {
        id: "p-gift",
        product_key: "christmas_send_a_gift",
        active: true,
        public_discoverable: false,
        route_path: "/send-a-gift",
      },
    ];
    const packages: ControlPackageRow[] = [
      { product_id: "p-photo", package_key: "single", active: true, purchasable: false },
      { product_id: "p-gift", package_key: "classic", active: true, purchasable: true },
    ];

    const snap = buildChristmasControlSnapshot({ orders, events, products, packages });

    expect(snap.attention.fulfillmentFailed).toBe(1);
    expect(snap.attention.fulfillmentQueued).toBe(1);
    expect(snap.attention.paymentFailed).toBe(1);
    expect(snap.orderRows).toBe(3);
    expect(isChristmasControlEmpty(snap)).toBe(false);

    const photo = snap.products.find((p) => p.productKey === "christmas_photo");
    expect(photo?.orders).toBe(2);
    expect(photo?.paid).toBe(1);
    expect(photo?.fulfillmentFailed).toBe(1);
    expect(photo?.funnelSessions).toBe(1);
    expect(photo?.purchasablePackages).toBe(0);
    expect(photo?.liveActive).toBe(true);

    expect(snap.sendAGift.inLiveCatalog).toBe(true);
    expect(snap.sendAGift.orders).toBe(1);
    expect(snap.sendAGift.paid).toBe(1);
    expect(snap.sendAGift.funnelSessions).toBe(1);
  });

  it("treats a zero-data range as empty without mock counts", () => {
    const snap = buildChristmasControlSnapshot({
      orders: [],
      events: [],
      products: [],
      packages: [],
    });
    expect(isChristmasControlEmpty(snap)).toBe(true);
    expect(snap.attention).toEqual({
      fulfillmentFailed: 0,
      fulfillmentQueued: 0,
      fulfillmentProcessing: 0,
      paymentFailed: 0,
    });
    expect(snap.sendAGift.inLiveCatalog).toBe(false);
    expect(snap.products.length).toBeGreaterThan(0);
    expect(snap.products.every((p) => p.orders === 0 && p.funnelSessions === 0)).toBe(true);
  });

  it("exposes primary ops links for orders, send-a-gift, and funnels", () => {
    const ids = CHRISTMAS_CONTROL_PRIMARY_LINKS.map((link) => link.id);
    expect(ids).toEqual(["orders", "send-a-gift", "funnels"]);
    expect(CHRISTMAS_CONTROL_PRIMARY_LINKS[0]?.to).toBe(CHRISTMAS_ORDERS_PATH);
    expect(CHRISTMAS_CONTROL_PRIMARY_LINKS[1]?.to).toBe(CHRISTMAS_SEND_A_GIFT_PATH);
    expect(CHRISTMAS_CONTROL_PRIMARY_LINKS[2]?.to).toBe(CHRISTMAS_FUNNELS_HASH);
    expect(isSendAGiftProductKey("christmas_send_a_gift")).toBe(true);
    expect(isSendAGiftProductKey("christmas_photo")).toBe(false);
  });

  it("increments sparse status maps", () => {
    const map: Record<string, number> = {};
    incrementCount(map, "paid");
    incrementCount(map, "paid");
    incrementCount(map, "  ");
    expect(map.paid).toBe(2);
    expect(map.unknown).toBe(1);
  });
});

describe("christmas control wiring", () => {
  it("registers /admin/christmas-control behind AdminRoute and in admin nav", () => {
    const app = readSrc("src/App.tsx");
    const layout = readSrc("src/layouts/AdminLayout.tsx");
    const page = readSrc("src/pages/admin/ChristmasControlCenterPage.tsx");
    const service = readSrc("src/features/christmas/adminControl/controlService.ts");

    expect(app).toContain('path="christmas-control"');
    expect(app).toContain("ChristmasControlCenterPage");
    expect(app).toMatch(/<AdminRoute>[\s\S]*christmas-control/);
    expect(app).toContain('path="send-a-gift"');
    expect(layout).toContain(CHRISTMAS_CONTROL_PATH);
    expect(layout).toContain("Christmas Control");
    expect(page).toContain(CHRISTMAS_ORDERS_PATH);
    expect(page).toContain(CHRISTMAS_SEND_A_GIFT_PATH);
    expect(page).toContain("#funnels");
    expect(page).not.toMatch(/from ["']@\/lib\/supabase["']/);
    expect(service).toContain('from("christmas_orders")');
    expect(service).toContain("CHRISTMAS_CONTROL_ORDER_SELECT");
  });
});
