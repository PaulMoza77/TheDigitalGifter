import { describe, expect, it, vi, beforeEach } from "vitest";

const memory = new Map<string, string>();
const storage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memory.set(k, String(v));
  },
  clear: () => memory.clear(),
  removeItem: (k: string) => {
    memory.delete(k);
  },
  key: () => null,
  length: 0,
};

vi.stubGlobal("window", {
  localStorage: storage,
  sessionStorage: storage,
});

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/metaPixel", () => ({
  trackMetaInitiateCheckout: vi.fn(),
  trackMetaPurchaseOnce: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics";
import { trackMetaInitiateCheckout, trackMetaPurchaseOnce } from "@/lib/metaPixel";
import {
  buildSendAGiftCapiPurchase,
  buildSendAGiftGa4PurchasePayload,
  sendAGiftMetaInitiateCheckoutEventId,
  sendAGiftMetaPurchaseEventId,
  trackSendAGiftGa4Purchase,
  trackSendAGiftMetaInitiateCheckout,
  trackSendAGiftMetaPurchase,
} from "./purchaseAnalytics";

describe("Send-a-Gift purchase analytics contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memory.clear();
  });

  it("builds GA4 purchase with transaction_id value currency items", () => {
    const payload = buildSendAGiftGa4PurchasePayload({
      orderId: "ord-1",
      amountCents: 1999,
      currency: "usd",
      packageKey: "classic",
    });
    expect(payload.transaction_id).toBe("ord-1");
    expect(payload.value).toBe(19.99);
    expect(payload.currency).toBe("USD");
    expect(payload.items[0]?.item_variant).toBe("classic");
  });

  it("is replay-safe for GA4 purchase", () => {
    const input = {
      orderId: "ord-replay",
      amountCents: 500,
      packageKey: "starter",
      paidAt: "2026-09-06T00:00:00Z",
    };
    expect(trackSendAGiftGa4Purchase(input)).toBe(true);
    expect(trackSendAGiftGa4Purchase(input)).toBe(false);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it("uses identical event_id for Meta Pixel builder and CAPI Purchase", () => {
    const orderId = "ord-meta";
    expect(sendAGiftMetaPurchaseEventId(orderId)).toBe("send_a_gift_purchase_ord-meta");
    expect(buildSendAGiftCapiPurchase({ orderId, amountCents: 100 }).event_id).toBe(
      sendAGiftMetaPurchaseEventId(orderId),
    );
    expect(sendAGiftMetaInitiateCheckoutEventId(orderId)).toBe("send_a_gift_ic_ord-meta");
  });

  it("fires Meta IC and Purchase with shared event ids", () => {
    trackSendAGiftMetaInitiateCheckout({ orderId: "ord-2", amountCents: 800 });
    expect(trackMetaInitiateCheckout).toHaveBeenCalledWith({
      eventId: "send_a_gift_ic_ord-2",
      valueCents: 800,
      orderId: "ord-2",
    });

    trackSendAGiftMetaPurchase({
      orderId: "ord-2",
      amountCents: 800,
      paidAt: "2026-09-06T00:00:00Z",
    });
    expect(trackMetaPurchaseOnce).toHaveBeenCalledWith({
      eventId: "send_a_gift_purchase_ord-2",
      amountCents: 800,
      orderId: "ord-2",
      paidAt: "2026-09-06T00:00:00Z",
    });
  });

  it("never embeds email or gift message fields in CAPI custom_data", () => {
    const capi = buildSendAGiftCapiPurchase({ orderId: "ord-3", amountCents: 100 });
    const json = JSON.stringify(capi);
    expect(json).not.toMatch(/email/i);
    expect(json).not.toMatch(/message/i);
    expect(json).not.toMatch(/@/);
  });
});
