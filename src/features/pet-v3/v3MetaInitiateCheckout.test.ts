import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackMetaInitiateCheckout } from "@/lib/metaPixel";
import { trackFunnelBeginCheckout } from "../pet/funnelAnalytics";
import {
  fireV3InitiateCheckoutOnce,
  resetV3InitiateCheckoutOnceForTests,
} from "./v3MetaInitiateCheckout";

vi.mock("@/lib/metaPixel", () => ({
  trackMetaInitiateCheckout: vi.fn(),
}));

vi.mock("../pet/funnelAnalytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pet/funnelAnalytics")>();
  return {
    ...actual,
    trackFunnelBeginCheckout: vi.fn(),
  };
});

vi.mock("../pet/supabaseApi", () => ({
  petFunnelApi: {
    recordV3InitiateCheckout: vi.fn().mockResolvedValue({
      eventId: "pet_ic_order-1",
      sent: true,
      alreadySent: false,
    }),
  },
}));

import { petFunnelApi } from "../pet/supabaseApi";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("V3 Meta InitiateCheckout timing", () => {
  beforeEach(() => {
    vi.mocked(trackMetaInitiateCheckout).mockClear();
    vi.mocked(trackFunnelBeginCheckout).mockClear();
    vi.mocked(petFunnelApi.recordV3InitiateCheckout).mockClear();
    resetV3InitiateCheckoutOnceForTests();
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
  });

  it("1. Stripe session auto-created: server defers CAPI IC for V3", () => {
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(funnel).toContain("shouldDeferInitiateCheckoutToInteraction");
    expect(funnel).toContain("maybeRecordInitiateCheckoutOnSessionCreate");
    expect(funnel).toContain('action === "recordV3InitiateCheckout"');
    expect(readSrc("supabase/functions/_shared/pet/v3InitiateCheckout.ts")).toContain(
      'funnelVariant ?? "").trim() === "v3"',
    );
    expect(readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts")).not.toContain("trackMetaInitiateCheckout");
    expect(readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts")).not.toContain("recordV3InitiateCheckout");
  });

  it("2. Stripe ready: checkout_viewed only, Pixel IC 0, CAPI IC 0", () => {
    const offer = readSrc("src/features/pet-v3/screens/OfferScreen.tsx");
    expect(offer).toContain("onReady={markCheckoutViewed}");
    expect(offer).not.toContain("onReady={markBeginCheckout}");
    expect(vi.mocked(trackMetaInitiateCheckout)).not.toHaveBeenCalled();
    expect(vi.mocked(petFunnelApi.recordV3InitiateCheckout)).not.toHaveBeenCalled();
  });

  it("3. first interaction: begin_checkout + Pixel IC + GA4 + server CAPI", () => {
    fireV3InitiateCheckoutOnce({
      orderId: "order-1",
      publicToken: "token-1",
      eventId: "pet_ic_order-1",
      amountCents: 1200,
    });
    expect(trackFunnelBeginCheckout).toHaveBeenCalledWith({
      eventId: "pet_ic_order-1",
      valueCents: 1200,
      orderId: "order-1",
      species: "cat",
    });
    expect(petFunnelApi.recordV3InitiateCheckout).toHaveBeenCalledWith({
      orderId: "order-1",
      publicToken: "token-1",
      eventId: "pet_ic_order-1",
      fbc: null,
      fbp: null,
    });
  });

  it("4. browser Pixel and server CAPI share pet_ic_{orderId}", () => {
    const offer = readSrc("src/features/pet-v3/screens/OfferScreen.tsx");
    expect(offer).toContain("pet_ic_${result.orderId}");
    expect(readSrc("supabase/functions/_shared/pet/meta.ts")).toContain("pet_ic_${orderId}");
    expect(readSrc("supabase/functions/_shared/pet/v3InitiateCheckout.ts")).toContain(
      "petInitiateCheckoutEventId",
    );
  });

  it("5. repeated interaction: GA4 and server CAPI remain once", () => {
    fireV3InitiateCheckoutOnce({
      orderId: "order-1",
      publicToken: "token-1",
      eventId: "pet_ic_order-1",
      amountCents: 1200,
    });
    fireV3InitiateCheckoutOnce({
      orderId: "order-1",
      publicToken: "token-1",
      eventId: "pet_ic_order-1",
      amountCents: 1200,
    });
    expect(trackFunnelBeginCheckout).toHaveBeenCalledTimes(1);
    expect(petFunnelApi.recordV3InitiateCheckout).toHaveBeenCalledTimes(1);
  });

  it("6. V1/V2 still send CAPI IC on session create", () => {
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(funnel).toContain("sendMetaCapiInitiateCheckout");
    expect(funnel).toContain("recordPetFunnelInitiateCheckout");
    expect(readSrc("src/features/pet/PetCheckoutPage.tsx")).toContain("trackMetaInitiateCheckout");
  });
});
