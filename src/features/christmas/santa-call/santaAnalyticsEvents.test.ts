import { beforeEach, expect, it, vi } from "vitest";
import { safeSantaParams, trackSantaCallAnalytics } from "./santaCallAnalytics";
import { readFileSync } from "node:fs";
let gtag: ReturnType<typeof vi.fn>;
beforeEach(() => {
  const session = new Map<string, string>();
  gtag = vi.fn();
  vi.stubGlobal("window", {
    gtag,
    location: {
      pathname: "/christmas/santa-call",
      origin: "https://www.thedigitalgifter.com",
      search: "?utm_source=facebook&fbclid=private",
    },
    localStorage: { getItem: () => "granted" },
    sessionStorage: {
      getItem: (k: string) => session.get(k),
      setItem: (k: string, v: string) => session.set(k, v),
    },
  });
});
it("allowlists event parameters and drops child PII/free text", () => {
  expect(
    safeSantaParams({
      email: "child@example.test",
      child_name: "Example",
      transcript: "secret",
      currency: "RON",
      value: 59,
      language: "ro",
      completion_reason: "private",
    }),
  ).toEqual({ currency: "RON", value: 59, language: "ro" });
});
it("maps a single canonical page event to GA4 without private URLs", () => {
  trackSantaCallAnalytics("santa_page_view", { market: "ro" });
  expect(gtag).toHaveBeenCalledTimes(1);
  expect(gtag.mock.calls[0]).toEqual([
    "event",
    "page_view",
    expect.objectContaining({
      page_location: "https://www.thedigitalgifter.com/christmas/santa-call",
      campaign_source: "facebook",
    }),
  ]);
  expect(JSON.stringify(gtag.mock.calls)).not.toContain("fbclid");
});
it("deduplicates purchase aliases by verified transaction ID", () => {
  const params = {
    transaction_id: "11111111-1111-4111-8111-111111111111",
    currency: "RON",
    value: 59,
  };
  trackSantaCallAnalytics("santa_purchase_confirmed", params);
  trackSantaCallAnalytics("santa_extension_purchased", params);
  expect(gtag).toHaveBeenCalledTimes(1);
  expect(gtag.mock.calls[0][1]).toBe("purchase");
});
it("rejects purchase without an order identifier and actual amount", () => {
  trackSantaCallAnalytics("santa_purchase_confirmed", { value: 59 });
  expect(gtag).not.toHaveBeenCalled();
});
it("does not emit without consent or on private rooms", () => {
  window.localStorage.getItem = () => "denied";
  trackSantaCallAnalytics("santa_checkout_started");
  window.localStorage.getItem = () => "granted";
  window.location.pathname = "/santa/call/private-token";
  trackSantaCallAnalytics("santa_call_started");
  expect(gtag).not.toHaveBeenCalled();
});
it("does not prevent checkout when analytics throws", () => {
  gtag.mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(() => trackSantaCallAnalytics("santa_checkout_started")).not.toThrow();
});
it("dispatches checkout analytics before the hosted redirect and only confirms paid LIVE purchases", () => {
  const page = readFileSync(
    new URL("../ChristmasSantaCallPage.tsx", import.meta.url),
    "utf8",
  );
  const commercial = page.slice(
    page.indexOf("const data = await startChristmasCheckout"),
  );
  expect(commercial.indexOf('"santa_checkout_started"')).toBeLessThan(
    commercial.indexOf("window.location.assign"),
  );
  expect(page).toContain(
    'data.livemode === true && data.stripe_mode === "live"',
  );
});
