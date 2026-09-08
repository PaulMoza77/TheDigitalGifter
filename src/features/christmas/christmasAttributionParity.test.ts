import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHRISTMAS_AFFILIATE_STORAGE_KEY,
  christmasPurchaseEventId,
  christmasUtmMix,
  coalesceChristmasAttribution,
} from "./attributionJoin";
import {
  buildChristmasCheckoutAttribution,
  readStoredAffiliateRef,
} from "./checkoutAttribution";
import { captureFunnelAttribution, FUNNEL_ATTRIBUTION_STORAGE_KEY } from "@/features/pet/funnelAttribution";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function installBrowser(pathname = "/christmas/family") {
  const session = new Map<string, string>();
  const local = new Map<string, string>();
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
      location: { search: "", pathname, hostname: "www.thedigitalgifter.com" },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { referrer: "", cookie: "" },
  });
  return { session, local };
}

describe("christmas attribution join", () => {
  it("coalesce never wipes affiliate_ref or first-touch UTMs", () => {
    const merged = coalesceChristmasAttribution(
      {
        affiliate_ref: "partner1",
        utm_source: "facebook",
        campaign_id: "111",
        has_meta_click: true,
      },
      {
        affiliate_ref: "",
        utm_source: "instagram",
        campaign_id: null,
        utm_medium: "paid_social",
        has_meta_click: false,
      },
    );
    expect(merged.affiliate_ref).toBe("partner1");
    expect(merged.utm_source).toBe("facebook");
    expect(merged.campaign_id).toBe("111");
    expect(merged.utm_medium).toBe("paid_social");
    expect(merged.has_meta_click).toBe(true);
  });

  it("purchase event_id matches pet-style order-stable CAPI id", () => {
    const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(christmasPurchaseEventId(orderId)).toBe(`xmas_purchase_${orderId}`);
  });

  it("admin UTM mix counts source, campaign, and affiliate", () => {
    const mix = christmasUtmMix([
      { utm_source: "facebook", utm_campaign: "xmas", affiliate_ref: "partner1", payment_status: "paid" },
      { utm_source: "facebook", utm_campaign: "retarget", affiliate_ref: null, payment_status: "pending" },
      { utm_source: null, utm_campaign: null, affiliate_ref: null, payment_status: "paid" },
    ]);
    expect(mix.total).toBe(3);
    expect(mix.paid).toBe(2);
    expect(mix.withUtm).toBe(2);
    expect(mix.withAffiliate).toBe(1);
    expect(mix.buckets[0]).toMatchObject({ source: "facebook", orders: 2, affiliate: 1 });
    expect(mix.buckets[0].campaigns).toEqual(expect.arrayContaining(["xmas", "retarget"]));
  });
});

describe("christmas checkout attribution client", () => {
  let local: Map<string, string>;

  beforeEach(() => {
    ({ local } = installBrowser("/christmas/santa-video"));
  });

  it("passes UTMs, campaign ids, stored affiliate_ref, and does not wipe affiliate_ref", () => {
    local.set(CHRISTMAS_AFFILIATE_STORAGE_KEY, "partner1");
    captureFunnelAttribution(
      "?utm_source=facebook&utm_medium=paid_social&utm_campaign=xmas&campaign_id=9&adset_id=8&ad_id=7&fbclid=Click.1",
    );
    const payload = buildChristmasCheckoutAttribution(
      "?utm_source=facebook&utm_medium=paid_social&utm_campaign=xmas&campaign_id=9&adset_id=8&ad_id=7&fbclid=Click.1",
    );
    expect(payload.utm_source).toBe("facebook");
    expect(payload.campaign_id).toBe("9");
    expect(payload.adset_id).toBe("8");
    expect(payload.ad_id).toBe("7");
    expect(payload.affiliate_ref).toBe("partner1");
    expect(payload.has_meta_click).toBe(true);
    expect(readStoredAffiliateRef()).toBe("partner1");
    expect(local.get(CHRISTMAS_AFFILIATE_STORAGE_KEY)).toBe("partner1");
    expect(window.sessionStorage.getItem(FUNNEL_ATTRIBUTION_STORAGE_KEY)).toContain("facebook");
  });
});

describe("christmas attribution wiring", () => {
  it("portrait and Santa checkout send the shared attribution payload", () => {
    const portrait = readSrc("src/features/christmas/ChristmasPortraitFunnelPage.tsx");
    const santa = readSrc("src/features/christmas/ChristmasSantaVideoPage.tsx");
    expect(portrait).toContain("buildChristmasCheckoutAttribution");
    expect(portrait).toContain("...attr");
    expect(portrait).toContain('trackChristmasEvent("purchase"');
    expect(santa).toContain("buildChristmasCheckoutAttribution");
    expect(santa).toContain("...attr");
    expect(santa).toContain('trackChristmasEvent("purchase"');
  });

  it("analytics carries affiliate_ref and GA4 purchase event_id", () => {
    const analytics = readSrc("src/features/christmas/analytics.ts");
    expect(analytics).toContain("affiliate_ref: affiliateRef");
    expect(analytics).toContain("christmasPurchaseEventId");
    expect(analytics).toContain('trackEvent("purchase"');
    expect(analytics).toContain('trackEvent("begin_checkout"');
  });

  it("checkout persists attribution to Stripe metadata and coalesces reuse", () => {
    const checkout = readSrc("supabase/functions/christmas-checkout/index.ts");
    expect(checkout).toContain("applyChristmasCheckoutAttributionMetadata");
    expect(checkout).toContain("coalesceChristmasAttribution");
    expect(checkout).toContain("orderAttributionColumns");
    expect(checkout).not.toContain("affiliate_ref: asString(body.affiliate_ref) || null");
  });

  it("commerce fulfill joins purchase + reuses pet sendMetaCapiPurchase", () => {
    const fulfill = readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts");
    const attr = readSrc("supabase/functions/_shared/christmas/attribution.ts");
    const meta = readSrc("supabase/functions/_shared/pet/meta.ts");
    expect(fulfill).toContain("joinAndSendChristmasPurchase");
    expect(attr).toContain("sendMetaCapiPurchase");
    expect(attr).toContain("xmas_purchase_");
    expect(attr).toContain("affiliate_ref");
    expect(attr).toContain('event_name: "purchase"');
    expect(meta).toContain("sku?: string | null");
    expect(fulfill.match(/from "\.\.\/pet\/meta\.ts"/g) || []).toHaveLength(0);
  });

  it("admin renders Christmas UTM mix", () => {
    const admin = readSrc("src/pages/admin/ChristmasOrders.tsx");
    expect(admin).toContain("christmasUtmMix");
    expect(admin).toContain("Christmas UTM mix");
    expect(admin).toContain("data-testid=\"christmas-utm-mix\"");
  });

  it("first-touch landing paths include /christmas without dropping /pet", () => {
    const attribution = readSrc("src/features/pet/funnelAttribution.ts");
    expect(attribution).toContain("isTrackedFunnelLandingPath");
    expect(attribution).toContain('path === "/christmas"');
    expect(attribution).toContain('path.startsWith("/pet/")');
  });
});
