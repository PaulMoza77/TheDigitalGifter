import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { PET_PRODUCT_SKU } from "./types";
import {
  FUNNEL_EVENT_KEYS,
  GA4_FUNNEL_EVENTS,
  shouldTrackPetBeginCheckout,
  shouldTrackPetPurchase,
  trackFunnelBeginCheckout,
  trackFunnelEvent,
  trackFunnelPurchase,
  trackFunnelViewItem,
} from "./funnelAnalytics";
import { captureFunnelAttribution } from "./funnelAttribution";
import { trackMetaInitiateCheckout, trackMetaPurchaseOnce } from "@/lib/metaPixel";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

type FbqCall = unknown[];
type GtagCall = unknown[];

function installBrowser() {
  const session = new Map<string, string>();
  const local = new Map<string, string>();
  const fbqCalls: FbqCall[] = [];
  const gtagCalls: GtagCall[] = [];
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: storage(session),
      localStorage: storage(local),
      location: { search: "", href: "https://www.thedigitalgifter.com/pet/dog" },
      fbq: (...args: unknown[]) => {
        fbqCalls.push(args);
      },
      gtag: (...args: unknown[]) => {
        gtagCalls.push(args);
      },
      dataLayer: [] as unknown[],
    },
  });

  return { fbqCalls, gtagCalls, session, local };
}

function gaEvents(gtagCalls: GtagCall[], name: string) {
  return gtagCalls.filter((call) => call[0] === "event" && call[1] === name);
}

function metaCustomEvents(fbqCalls: FbqCall[], name: string) {
  return fbqCalls.filter((call) => call[0] === "trackCustom" && call[1] === name);
}

describe("pet funnel dual analytics", () => {
  let fbqCalls: FbqCall[] = [];
  let gtagCalls: GtagCall[] = [];

  beforeEach(() => {
    const browser = installBrowser();
    fbqCalls = browser.fbqCalls;
    gtagCalls = browser.gtagCalls;
  });

  it("1. Meta custom event still fires", () => {
    trackFunnelEvent("PetNameSubmitted", { species: "dog" });
    expect(metaCustomEvents(fbqCalls, "PetNameSubmitted")).toHaveLength(1);
    expect(fbqCalls[0]?.[2]).toMatchObject({
      content_ids: [PET_PRODUCT_SKU],
      content_type: "product",
      species: "dog",
    });
  });

  it("2. corresponding GA4 event also fires", () => {
    trackFunnelEvent("PetNameSubmitted", { species: "dog" });
    expect(gaEvents(gtagCalls, "pet_name_submitted")).toHaveLength(1);
    expect(gaEvents(gtagCalls, "pet_name_submitted")[0]?.[2]).toMatchObject({
      product_id: PET_PRODUCT_SKU,
      species: "dog",
      step: "name",
      send_to: "G-YF2GRM2TL4",
    });
  });

  it("3. React rerenders do not duplicate Meta or GA4 events", () => {
    trackFunnelEvent("PetNameSubmitted", { species: "dog" });
    trackFunnelEvent("PetNameSubmitted", { species: "dog" });
    trackFunnelEvent("PetNameSubmitted", { species: "dog" });
    trackFunnelEvent("PetOrderReviewViewed", { species: "dog" });
    trackFunnelEvent("PetOrderReviewViewed", { species: "cat" });
    expect(metaCustomEvents(fbqCalls, "PetNameSubmitted")).toHaveLength(1);
    expect(gaEvents(gtagCalls, "pet_name_submitted")).toHaveLength(1);
    expect(metaCustomEvents(fbqCalls, "PetOrderReviewViewed")).toHaveLength(1);
    expect(gaEvents(gtagCalls, "pet_order_review_viewed")).toHaveLength(1);
  });

  it("4. no forbidden PII fields are sent to Meta or GA4", () => {
    captureFunnelAttribution(
      "?utm_source=facebook&fbclid=abc.123&email=you@email.com",
    );
    trackFunnelEvent("PetNameSubmitted", {
      species: "dog",
      petName: "Charlie",
      email: "you@email.com",
      photoUrl: "https://example.com/photo.jpg",
      token: "secret-token",
      publicToken: "pub-token",
      customerName: "Jane Doe",
    });
    const metaPayload = JSON.stringify(fbqCalls[0]?.[2] ?? {});
    const gaPayload = JSON.stringify(gaEvents(gtagCalls, "pet_name_submitted")[0]?.[2] ?? {});
    for (const payload of [metaPayload, gaPayload]) {
      expect(payload).not.toMatch(/Charlie|you@email|photo\.jpg|secret-token|pub-token|Jane Doe/i);
    }
    expect(metaPayload).not.toContain("fbclid");
    expect(gaPayload).toContain("utm_source");
  });

  it("5. PhotoUploadCompleted only fires after a successful upload", async () => {
    async function simulateCreatePageUpload(upload: () => Promise<{ ok: boolean }>) {
      trackFunnelEvent("PhotoUploadStarted", { species: "dog" });
      const result = await upload();
      if (!result.ok) return false;
      trackFunnelEvent("PhotoUploadCompleted", { species: "dog" });
      return true;
    }

    await simulateCreatePageUpload(async () => ({ ok: false }));
    expect(metaCustomEvents(fbqCalls, "PhotoUploadStarted")).toHaveLength(1);
    expect(metaCustomEvents(fbqCalls, "PhotoUploadCompleted")).toHaveLength(0);
    expect(gaEvents(gtagCalls, "photo_upload_started")).toHaveLength(1);
    expect(gaEvents(gtagCalls, "photo_upload_completed")).toHaveLength(0);

    await simulateCreatePageUpload(async () => ({ ok: true }));
    expect(metaCustomEvents(fbqCalls, "PhotoUploadCompleted")).toHaveLength(1);
    expect(gaEvents(gtagCalls, "photo_upload_completed")).toHaveLength(1);

    const create = readSrc("src/features/pet/PetCreatePage.tsx");
    expect(create).toMatch(/trackFunnelEvent\("PhotoUploadStarted"/);
    expect(create).toMatch(/if \(!result\.ok\)[\s\S]*return;[\s\S]*trackFunnelEvent\("PhotoUploadCompleted"/);
    expect(create).not.toMatch(/onFileRejected[\s\S]*PhotoUploadCompleted/);
  });

  it("6. begin_checkout only fires after successful Stripe checkout creation", () => {
    expect(
      shouldTrackPetBeginCheckout({
        status: "open",
        sessionId: "cs_test",
        checkoutUrl: "/pet/checkout",
      }),
    ).toBe(false);
    expect(
      shouldTrackPetBeginCheckout({
        status: "open",
        sessionId: "cs_live",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_live",
      }),
    ).toBe(true);
    expect(
      shouldTrackPetBeginCheckout({
        status: "comped",
        sessionId: "cs_live",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_live",
      }),
    ).toBe(false);

    trackFunnelBeginCheckout({
      eventId: "pet_ic_order-1",
      valueCents: 2700,
      orderId: "order-1",
      species: "dog",
    });
    trackFunnelBeginCheckout({
      eventId: "pet_ic_order-1",
      valueCents: 2700,
      orderId: "order-1",
      species: "dog",
    });
    expect(gaEvents(gtagCalls, "begin_checkout")).toHaveLength(1);
    expect(gaEvents(gtagCalls, "begin_checkout")[0]?.[2]).toMatchObject({
      currency: "USD",
      value: 27,
      product_id: PET_PRODUCT_SKU,
      send_to: "G-YF2GRM2TL4",
    });

    const checkout = readSrc("src/features/pet/PetCheckoutPage.tsx");
    expect(checkout).toContain("shouldTrackPetBeginCheckout");
    expect(checkout).toContain("trackMetaInitiateCheckout");
    expect(checkout).toContain("trackFunnelBeginCheckout");
    expect(checkout).toMatch(/async function pay\([\s\S]*trackFunnelBeginCheckout/);
    expect(checkout).toMatch(
      /useEffect\(\(\) => \{[\s\S]*trackFunnelEvent\(\s*"PetOrderReviewViewed"/,
    );
  });

  it("7. GA4 purchase cannot double count the same order", () => {
    expect(shouldTrackPetPurchase({ paidAt: null, amountCents: 2700 })).toBe(false);
    trackFunnelPurchase({
      eventId: "pet_purchase_order-1",
      amountCents: 2700,
      orderId: "order-1",
    });
    expect(gaEvents(gtagCalls, "purchase")).toHaveLength(0);

    trackFunnelPurchase({
      eventId: "pet_purchase_order-1",
      amountCents: 2700,
      orderId: "order-1",
      paidAt: "2026-08-21T00:00:00Z",
      species: "dog",
    });
    trackFunnelPurchase({
      eventId: "pet_purchase_order-1",
      amountCents: 2700,
      orderId: "order-1",
      paidAt: "2026-08-21T00:00:00Z",
      species: "dog",
    });
    expect(gaEvents(gtagCalls, "purchase")).toHaveLength(1);
    expect(gaEvents(gtagCalls, "purchase")[0]?.[2]).toMatchObject({
      transaction_id: "order-1",
      currency: "USD",
      value: 27,
      product_id: PET_PRODUCT_SKU,
    });

    trackFunnelPurchase({
      eventId: "pet_purchase_order-2",
      amountCents: 2700,
      orderId: "order-2",
      paidAt: "2026-08-21T01:00:00Z",
    });
    expect(gaEvents(gtagCalls, "purchase")).toHaveLength(2);

    window.sessionStorage.removeItem("tdg.ga4.purchase.pet_purchase_order-1");
    trackFunnelPurchase({
      eventId: "pet_purchase_order-1",
      amountCents: 2700,
      orderId: "order-1",
      paidAt: "2026-08-21T00:00:00Z",
    });
    expect(gaEvents(gtagCalls, "purchase")).toHaveLength(2);
  });

  it("8-10. attribution is captured first-touch and malformed params do not break the app", () => {
    expect(() =>
      captureFunnelAttribution("?utm_source=<script>&campaign_id=https://evil.test"),
    ).not.toThrow();
    expect(captureFunnelAttribution("not a query")).toEqual({});

    const first = captureFunnelAttribution(
      "?utm_source=facebook&utm_medium=paid_social&utm_campaign=secret-life&utm_content=hook-a&campaign_id=111&adset_id=222&ad_id=333&fbclid=click.1",
    );
    expect(first).toMatchObject({
      utm_source: "facebook",
      utm_medium: "paid_social",
      campaign_id: "111",
      adset_id: "222",
      ad_id: "333",
    });
    expect(first).not.toHaveProperty("fbclid");

    const second = captureFunnelAttribution(
      "?utm_source=google&utm_campaign=other&campaign_id=999&ad_id=888",
    );
    expect(second.utm_source).toBe("facebook");
    expect(second.campaign_id).toBe("111");
    expect(second.ad_id).toBe("333");

    trackFunnelViewItem({ species: "dog", valueCents: 2700 });
    const viewItem = gaEvents(gtagCalls, "view_item")[0]?.[2] as Record<string, unknown>;
    expect(viewItem).toMatchObject({
      utm_source: "facebook",
      campaign_id: "111",
      ad_id: "333",
      currency: "USD",
      value: 27,
    });
    expect(JSON.stringify(viewItem.items)).toContain(PET_PRODUCT_SKU);
  });

  it("11. existing Meta CAPI/browser deduplication remains intact", () => {
    trackMetaInitiateCheckout({
      eventId: "pet_ic_order-9",
      valueCents: 2700,
      orderId: "order-9",
    });
    trackMetaInitiateCheckout({
      eventId: "pet_ic_order-9",
      valueCents: 2700,
      orderId: "order-9",
    });
    const initiate = fbqCalls.filter((call) => call[1] === "InitiateCheckout");
    expect(initiate).toHaveLength(1);
    expect(initiate[0]?.[3]).toEqual({ eventID: "pet_ic_order-9" });

    trackMetaPurchaseOnce({
      eventId: "pet_purchase_order-9",
      amountCents: 2700,
      orderId: "order-9",
      paidAt: "2026-08-21T00:00:00Z",
    });
    trackMetaPurchaseOnce({
      eventId: "pet_purchase_order-9",
      amountCents: 2700,
      orderId: "order-9",
      paidAt: "2026-08-21T00:00:00Z",
    });
    const purchase = fbqCalls.filter((call) => call[1] === "Purchase");
    expect(purchase).toHaveLength(1);
    expect(purchase[0]?.[3]).toEqual({ eventID: "pet_purchase_order-9" });

    const capi = readSrc("supabase/functions/_shared/pet/meta.ts");
    expect(capi).toContain("event_id: input.eventId");
    expect(capi).toContain("pet_ic_");
    expect(capi).toContain("pet_purchase_");
    expect(capi).toContain("sendMetaCapiInitiateCheckout");
    expect(capi).toContain("sendMetaCapiPurchase");
    expect(readSrc("src/lib/metaPixel.ts")).toContain("tdg.meta.initiateCheckout.");
    expect(readSrc("src/lib/metaPixel.ts")).toContain("tdg.meta.purchase.");
  });

  it("maps every custom funnel event to the expected GA4 name", () => {
    expect(GA4_FUNNEL_EVENTS).toEqual({
      PetNameSubmitted: "pet_name_submitted",
      PetSubtypeSelected: "pet_subtype_selected",
      PhotoUploadStarted: "photo_upload_started",
      PhotoUploadCompleted: "photo_upload_completed",
      PetDetailsCompleted: "pet_details_completed",
      PetOrderReviewViewed: "pet_order_review_viewed",
      ViewContent: "view_item",
      InitiateCheckout: "begin_checkout",
      CheckoutError: "checkout_error",
    });
    expect(FUNNEL_EVENT_KEYS.PetNameSubmitted).toBe("tdg.funnel.PetNameSubmitted");
  });

  it("does not load a second GA script or Measurement ID", () => {
    const html = readSrc("index.html");
    expect(html.match(/gtag\/js\?id=/g)?.length).toBe(1);
    expect(html.match(/G-YF2GRM2TL4/g)?.length).toBeGreaterThan(0);
    expect(html).not.toMatch(/G-(?!YF2GRM2TL4)[A-Z0-9]+/);
    expect(readSrc("src/lib/analytics.ts")).toContain('export const GA_ID = "G-YF2GRM2TL4"');
    expect(readSrc("src/App.tsx")).toContain("skipInitialHtmlPageView");
    expect(readSrc("src/App.tsx")).toContain("captureFunnelAttribution");
  });

  it("still uses Meta trackCustom names and does not rename them", () => {
    trackFunnelEvent("PhotoUploadCompleted", { species: "cat" });
    expect(fbqCalls[0]?.[0]).toBe("trackCustom");
    expect(fbqCalls[0]?.[1]).toBe("PhotoUploadCompleted");
    expect(gaEvents(gtagCalls, "photo_upload_completed")).toHaveLength(1);
  });

  it("GA4 no-ops when gtag is unavailable without throwing", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: {
          getItem: () => null,
          setItem: () => {
            throw new Error("quota");
          },
        },
        localStorage: {
          getItem: () => {
            throw new Error("blocked");
          },
          setItem: () => {
            throw new Error("blocked");
          },
        },
        gtag: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(() => trackFunnelEvent("CheckoutError", { species: "dog" })).not.toThrow();
    expect(() =>
      captureFunnelAttribution("?utm_source=facebook&campaign_id=<bad>"),
    ).not.toThrow();
  });
});
