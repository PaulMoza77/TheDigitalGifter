import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { PET_PRODUCT_SKU } from "@/features/pet/types";
import {
  TDG_META_PIXEL_ID,
  buildMetaCustomData,
  metaCustomDataHasForbiddenFields,
  sanitizedEventSourceUrl,
  trackMetaInitiateCheckout,
  trackMetaPurchaseOnce,
  trackMetaViewContent,
} from "./metaPixel";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("TDG Meta Pixel", () => {
  const calls: unknown[][] = [];

  beforeEach(() => {
    calls.length = 0;
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => {
            store.set(key, value);
          },
        },
        fbq: (...args: unknown[]) => {
          calls.push(args);
        },
      },
    });
  });

  it("replaces the old Pixel ID and initializes the new dataset once", () => {
    const html = readSrc("index.html");
    expect(html).not.toContain("1673980440653322");
    expect(html.match(/fbq\("init"/g)?.length).toBe(1);
    expect(html).toContain(`fbq("init", "${TDG_META_PIXEL_ID}")`);
    expect(html).toContain(`facebook.com/tr?id=${TDG_META_PIXEL_ID}&ev=PageView&noscript=1`);
    expect(readSrc("src/App.tsx")).not.toMatch(/fbq\(["']init/);
    expect(readSrc("supabase/functions/_shared/pet/meta.ts")).toContain(TDG_META_PIXEL_ID);
    expect(readSrc("supabase/functions/_shared/pet/meta.ts")).not.toContain("1673980440653322");
  });

  it("keeps META_CAPI_ACCESS_TOKEN as a secret name only", () => {
    const meta = readSrc("supabase/functions/_shared/pet/meta.ts");
    expect(meta).toContain("Deno.env.get(\"META_CAPI_ACCESS_TOKEN\")");
    expect(meta).not.toMatch(/META_CAPI_ACCESS_TOKEN["']?\s*[:=]\s*["'][^"']+["']/);
    expect(readSrc(".env.example")).not.toMatch(/META_CAPI_ACCESS_TOKEN=/);
  });

  it("ViewContent and InitiateCheckout use a provided server-owned amount", () => {
    trackMetaViewContent({ valueCents: 5900, onceKey: "vc-dog" });
    trackMetaViewContent({ valueCents: 5900, onceKey: "vc-dog" });
    trackMetaInitiateCheckout({ eventId: "pet_ic_order-1", valueCents: 7900, orderId: "order-1" });
    expect(calls[0]?.[0]).toBe("track");
    expect(calls[0]?.[1]).toBe("ViewContent");
    expect(calls[0]?.[2]).toMatchObject({ value: 59, currency: "USD", content_ids: [PET_PRODUCT_SKU] });
    expect(calls.filter((call) => call[1] === "ViewContent")).toHaveLength(1);
    expect(calls[1]?.[1]).toBe("InitiateCheckout");
    expect(calls[1]?.[2]).toMatchObject({ value: 79, currency: "USD", order_id: "order-1" });
    expect(calls[1]?.[3]).toEqual({ eventID: "pet_ic_order-1" });
    expect(readSrc("src/lib/metaPixel.ts")).not.toMatch(/value:\s*PET_PRICE_CENTS/);
    expect(readSrc("src/features/pet/PetLandingPage.tsx")).toContain("offerVerified");
    expect(readSrc("src/features/pet/PetCheckoutPage.tsx")).toContain("serverAmount");
  });

  it("Purchase fires only after verified payment with matching event_id", () => {
    trackMetaPurchaseOnce({
      eventId: "pet_purchase_order-1",
      amountCents: 5900,
      orderId: "order-1",
    });
    expect(calls).toHaveLength(0);
    trackMetaPurchaseOnce({
      eventId: "pet_purchase_order-1",
      amountCents: 5900,
      orderId: "order-1",
      paidAt: "2026-08-17T00:00:00Z",
    });
    trackMetaPurchaseOnce({
      eventId: "pet_purchase_order-1",
      amountCents: 5900,
      orderId: "order-1",
      paidAt: "2026-08-17T00:00:00Z",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toBe("Purchase");
    expect(calls[0]?.[2]).toMatchObject({
      value: 59,
      currency: "USD",
      content_ids: [PET_PRODUCT_SKU],
      order_id: "order-1",
    });
    expect(calls[0]?.[3]).toEqual({ eventID: "pet_purchase_order-1" });
    expect(readSrc("src/features/pet/PetOrderPage.tsx")).toContain("paidAt");
    expect(readSrc("supabase/functions/_shared/pet/stripeFulfill.ts")).toContain("sendMetaCapiPurchase");
    expect(readSrc("supabase/functions/_shared/pet/meta.ts")).toContain("pet_purchase_");
  });

  it("never puts tokens, photo URLs, or emails in event_source_url or custom_data", () => {
    const url = sanitizedEventSourceUrl(
      "https://www.thedigitalgifter.com/pet/order?token=secret-token&session_id=cs_test",
    );
    expect(url).toBe("https://www.thedigitalgifter.com/pet/order");
    expect(url).not.toContain("token");
    const data = buildMetaCustomData({ valueCents: 5900, orderId: "order-1" });
    expect(metaCustomDataHasForbiddenFields(data)).toBe(false);
    expect(
      metaCustomDataHasForbiddenFields({
        ...data,
        email: "you@email.com",
      }),
    ).toBe(true);
    expect(
      metaCustomDataHasForbiddenFields({
        ...data,
        photoUrl: "https://example.com/photo.jpg",
      }),
    ).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/@|https?:|token/i);
    const capi = readSrc("supabase/functions/_shared/pet/meta.ts");
    expect(capi).toContain("hashIdentifier");
    expect(capi).toContain("user_data: hashedEmail ? { em: [hashedEmail] } : {}");
    expect(capi).toContain("custom_data: data");
    expect(capi).not.toMatch(/custom_data:\s*\{[\s\S]*email/);
  });

  it("skips the initial HTML PageView and tracks later SPA path changes", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain("MetaSpaPageViewTracker");
    expect(app).toContain("skipInitialHtmlPageView");
    expect(app).toContain("trackMetaSpaPageView(location.pathname)");
    expect(readSrc("index.html")).toContain('fbq("track", "PageView")');
  });
});
