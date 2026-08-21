import { beforeEach, describe, expect, it } from "vitest";
import { GA_ID, trackEvent, trackPageView } from "./analytics";

describe("GA4 analytics wrapper", () => {
  const calls: unknown[][] = [];

  beforeEach(() => {
    calls.length = 0;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        dataLayer: [],
        gtag: (...args: unknown[]) => {
          calls.push(args);
        },
        location: { pathname: "/pet/dog", search: "", href: "https://www.thedigitalgifter.com/pet/dog" },
        document: { title: "Pet" },
      },
    });
  });

  it("sends events to the existing Measurement ID", () => {
    trackEvent("view_item", { currency: "USD", value: 27 });
    expect(calls[0]).toEqual(["event", "view_item", { currency: "USD", value: 27, send_to: GA_ID }]);
  });

  it("does not throw when gtag is blocked", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        gtag: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(() => trackEvent("purchase", { transaction_id: "order-1" })).not.toThrow();
    expect(() => trackPageView("/pet/dog")).not.toThrow();
  });
});
