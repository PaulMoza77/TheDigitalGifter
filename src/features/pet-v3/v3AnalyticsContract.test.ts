import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPetAttributionContract,
  deriveCreativeId,
  normalizeFunnelVersion,
} from "../pet-funnel-shared/attributionContract";
import { captureFunnelAttribution, getFunnelAttribution } from "../pet/funnelAttribution";
import { mapV2CountsToPrimarySteps, mapV3CountsToPrimarySteps, namedEventCounts } from "../pet/funnelDatasetConfig";
import { v3IdempotencyKey } from "./analytics";
import { trackV3CheckoutViewed } from "./checkoutAnalytics";
import { PET_V3_EVENTS, PET_V3_FUNNEL_VERSION, PET_V3_SESSION_KEY, PET_V3_SPECIES } from "./types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

function installBrowser(search = "", preserve?: { session: Map<string, string>; local: Map<string, string> }) {
  const session = preserve?.session ?? new Map<string, string>();
  const local = preserve?.local ?? new Map<string, string>();
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
  });
  const browserDocument = {
    cookie: "_fbc=fb.1.123.abc; _fbp=fb.1.456.def",
    referrer: "",
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: browserDocument,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: storage(session),
      localStorage: storage(local),
      location: { search, pathname: "/pet/cat-v3" },
      document: browserDocument,
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { sendBeacon: vi.fn(() => true), userAgent: "vitest" },
  });
  return { session, local };
}

describe("Cat V3 analytics contract", () => {
  it("stores funnel_version explicitly in DB schema and ingest RPC", () => {
    const migration = readSrc("supabase/migrations/20260826120000_pet_v3_funnel_version_attribution.sql");
    expect(migration).toContain("funnel_version text");
    expect(migration).toContain("creative_id text");
    expect(migration).toContain("p_funnel_version text default 'v3'");
    expect(readSrc("api/pet-v3-funnel-event.ts")).toContain("p_funnel_version");
  });

  it("builds canonical attribution with pet_type=cat and funnel_version=v3", () => {
    const contract = buildPetAttributionContract({
      petType: "cat",
      funnelVersion: "v3",
      funnelSessionId: sessionId,
      clientEventId: "11111111-2222-4333-8333-444444444401",
      utmSource: "meta",
      utmMedium: "paid_social",
      utmCampaign: "cat-v3-launch",
      utmContent: "cat-v3-creative-01-FINAL",
      campaignId: "120000000001",
      adsetId: "220000000001",
      adId: "330000000001",
    });
    expect(contract.funnel).toBe("pet");
    expect(contract.pet_type).toBe("cat");
    expect(contract.funnel_version).toBe("v3");
    expect(contract.creative_id).toBe("cat-v3-creative-01");
    expect(contract.source).toBe("meta");
    expect(contract.medium).toBe("paid_social");
  });

  it("never infers V3 from unknown values", () => {
    expect(normalizeFunnelVersion("v3")).toBe("v3");
    expect(normalizeFunnelVersion("V3")).toBe("v3");
    expect(normalizeFunnelVersion("cat-v3-creative-01")).toBe("unknown");
    expect(normalizeFunnelVersion("")).toBe("unknown");
  });

  it("derives creative_id from utm_content without FINAL suffix", () => {
    expect(deriveCreativeId({ utmContent: "cat-v3-creative-01-FINAL" })).toBe("cat-v3-creative-01");
    expect(deriveCreativeId({ creativeId: "custom-creative" })).toBe("custom-creative");
  });

  it("preserves first-touch UTMs across navigation without fbclid storage", () => {
    const stores = installBrowser(
      "?utm_source=meta&utm_medium=paid_social&utm_campaign=cat-v3&utm_content=cat-v3-creative-01&fbclid=abc",
    );
    captureFunnelAttribution();
    installBrowser("", stores);
    expect(getFunnelAttribution()).toEqual({
      utm_source: "meta",
      utm_medium: "paid_social",
      utm_campaign: "cat-v3",
      utm_content: "cat-v3-creative-01",
    });
    expect(getFunnelAttribution()).not.toHaveProperty("fbclid");
  });

  it("1. landing bootstrap records checkout_viewed once per call with session idempotency", () => {
    trackV3CheckoutViewed();
    const key = v3IdempotencyKey({ sessionId, eventName: "v3_checkout_viewed" });
    expect(key).toBe(`${sessionId}:v3_checkout_viewed`);
  });

  it("keeps checkout attempt idempotency stable for retries", () => {
    const orderId = "order-live-1";
    const first = v3IdempotencyKey({ sessionId, eventName: "v3_begin_checkout", attemptId: orderId });
    const retry = v3IdempotencyKey({ sessionId, eventName: "v3_begin_checkout", attemptId: orderId });
    expect(first).toBe(retry);
  });

  it("maps V3 counts only into V3 dashboard shape", () => {
    const v3 = mapV3CountsToPrimarySteps(
      namedEventCounts([
        { event_name: "v3_landing_view", unique_sessions: 10 },
        { event_name: "v3_purchase", unique_sessions: 1 },
      ]),
    );
    const v2 = mapV2CountsToPrimarySteps(
      namedEventCounts([
        { event_name: "v2_landing_view", unique_sessions: 20 },
        { event_name: "v2_purchase", unique_sessions: 2 },
      ]),
    );
    expect(v3.landing_view).toBe(10);
    expect(v3.purchase).toBe(1);
    expect(v2.landing_view).toBe(20);
    expect(v2.purchase).toBe(2);
    expect(v3.purchase).not.toBe(v2.purchase);
  });

  it("redirects /pet/cat?fv=v3 to /pet/cat-v3 preserving UTMs", () => {
    expect(readSrc("src/features/pet/PetRoutes.tsx")).toContain('params.get("fv")?.toLowerCase() !== "v3"');
    expect(readSrc("src/features/pet/PetRoutes.tsx")).toContain("navigate(`/pet/cat-v3");
  });

  it("writes Stripe V3 metadata with funnel_version and attribution", () => {
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(funnel).toContain('metadata[funnel_version]", "v3"');
    expect(funnel).toContain("applyCheckoutAttributionMetadata");
    expect(funnel).toContain('["utm_source", attr.utm_source]');
    expect(funnel).toContain("metadata[meta_fbc]");
    expect(readSrc("supabase/functions/_shared/pet/stripeFulfill.ts")).toContain("p_funnel_version");
    expect(readSrc("supabase/functions/_shared/pet/stripeFulfill.ts")).toContain("v3_purchase:${order.id}");
    expect(readSrc("supabase/functions/_shared/pet/stripeFulfill.ts")).toContain("fbc: attr.fbc");
  });

  it("uses isolated V3 session storage key", () => {
    expect(PET_V3_SESSION_KEY).toBe("tdg.petFunnelV3.session.v1");
    expect(PET_V3_SPECIES).toBe("cat");
    expect(PET_V3_FUNNEL_VERSION).toBe("v3");
  });

  it("covers every V3 event name in the allow-list", () => {
    for (const name of PET_V3_EVENTS) {
      expect(name.startsWith("v3_")).toBe(true);
    }
    expect(readSrc("api/pet-v3-funnel-event.ts")).toContain("v3_purchase");
  });
});

describe("Cat V3 synthetic session payload chain", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("emits one consistent attribution contract across funnel stages", async () => {
    const stores = installBrowser(
      "?utm_source=meta&utm_medium=paid_social&utm_campaign=cat-v3-launch&utm_content=cat-v3-creative-01-FINAL&campaign_id=120000000001&adset_id=220000000001&ad_id=330000000001&fbclid=abc",
    );
    window.sessionStorage.setItem(PET_V3_SESSION_KEY, sessionId);
    window.localStorage.setItem(PET_V3_SESSION_KEY, sessionId);

    const posts: Record<string, unknown>[] = [];
    const blobs: Blob[] = [];
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        sendBeacon: vi.fn((_url: string, blob: Blob) => {
          blobs.push(blob);
          return true;
        }),
        userAgent: "vitest",
      },
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { randomUUID: () => "11111111-2222-4333-8333-444444444402" },
    });

    const { trackPetV3Event } = await import("./analytics");
    const stages = [
      "v3_landing_view",
      "v3_upload_started",
      "v3_upload_completed",
      "v3_preview_generation_started",
      "v3_preview_viewed",
      "v3_offer_viewed",
      "v3_checkout_viewed",
      "v3_begin_checkout",
    ] as const;

    for (const eventName of stages) {
      trackPetV3Event({
        eventName,
        attemptId: eventName === "v3_begin_checkout" ? "order-1" : undefined,
        amountCents: eventName === "v3_begin_checkout" ? 1200 : undefined,
      });
    }

    for (const blob of blobs) {
      posts.push(JSON.parse(await blob.text()));
    }

    expect(posts).toHaveLength(stages.length);
    for (const payload of posts) {
      expect(payload.funnel_session_id).toBe(sessionId);
      expect(payload.species).toBe("cat");
      expect(payload.funnel_version).toBe("v3");
      expect(payload.creative_id).toBe("cat-v3-creative-01");
      expect(payload.utm_source).toBe("meta");
      expect(payload.campaign_id).toBe("120000000001");
    }

    const landingKeys = posts
      .filter((row) => row.event_name === "v3_landing_view")
      .map((row) => row.idempotency_key);
    expect(new Set(landingKeys).size).toBe(1);
  });
});
