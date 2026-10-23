import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackChristmasPackCheckout, trackChristmasPackPurchase, trackChristmasPackView } from "./meta";
const fbq = vi.fn();
const store = new Map<string, string>();
const paid = { orderId: "test-order", status: "complete", paidAt: "2026-10-23T00:00:00Z", amountCents: 1700, currency: "eur", packKey: "magic" };
beforeEach(() => {
  fbq.mockClear(); store.clear(); store.set("tdg.cookie-consent.v1", "granted");
  vi.stubGlobal("window", { fbq, location: { pathname: "/christmas/photo-generator" }, addEventListener: vi.fn(), localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string,v: string) => store.set(k,v) } });
});
describe("Christmas Meta events", () => {
  it("sends the verified order amount and currency once across repeated polls and refreshes", () => {
    trackChristmasPackPurchase(paid); trackChristmasPackPurchase({ ...paid });
    expect(fbq).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith("track", "Purchase", expect.objectContaining({ value: 17, currency: "EUR", order_id: "test-order" }), { eventID: "christmas_purchase_test-order" });
  });
  it("rejects unpaid, canceled, failed, missing currency and invalid amounts", () => {
    for (const change of [{ status: "pending" }, { status: "failed" }, { status: "canceled" }, { paidAt: null }, { paidAt: "invalid" }, { currency: undefined }, { amountCents: NaN }, { amountCents: 0 }]) trackChristmasPackPurchase({ ...paid, ...change });
    expect(fbq).not.toHaveBeenCalled();
  });
  it("does not send without consent, including after revocation", () => {
    store.set("tdg.cookie-consent.v1", "denied");
    trackChristmasPackPurchase(paid); trackChristmasPackCheckout(paid); trackChristmasPackView();
    expect(fbq).not.toHaveBeenCalled();
    store.set("tdg.cookie-consent.v1", "granted"); trackChristmasPackPurchase(paid);
    expect(fbq).toHaveBeenCalledTimes(1);
  });
  it("does not consume deduplication while the Pixel is unavailable", () => {
    const win = window as Window & { fbq?: unknown }; win.fbq = undefined;
    trackChristmasPackPurchase(paid); win.fbq = fbq; trackChristmasPackPurchase(paid);
    expect(fbq).toHaveBeenCalledTimes(1);
  });
  it("deduplicates checkout by order with correct currency and no pet SKU", () => {
    trackChristmasPackCheckout(paid); trackChristmasPackCheckout(paid);
    expect(fbq).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith("track", "InitiateCheckout", expect.objectContaining({ currency: "EUR", value: 17, content_ids: ["christmas_photo"] }), { eventID: "christmas_ic_test-order" });
  });
});
