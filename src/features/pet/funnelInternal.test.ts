import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { captureFunnelAttribution } from "./funnelAttribution";
import { buildInternalFunnelPayload } from "./funnelInternal";
import { getPetFunnelSessionId, inferDeviceType, PET_FUNNEL_SESSION_KEY } from "./funnelSession";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function installBrowser(search = "") {
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
      location: { search, pathname: "/pet/dog" },
      navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
  });
  return { session, local };
}

describe("internal pet funnel events", () => {
  beforeEach(() => {
    installBrowser(
      "?utm_source=facebook&utm_campaign=secret-lives&utm_content=before-after&campaign_id=111&adset_id=222&ad_id=333&fbclid=secretclick",
    );
    captureFunnelAttribution();
  });

  it("persists one anonymous funnel session id first-party", () => {
    const first = getPetFunnelSessionId();
    const second = getPetFunnelSessionId();
    expect(first).toBe(second);
    expect(window.sessionStorage.getItem(PET_FUNNEL_SESSION_KEY)).toBe(first);
    expect(window.localStorage.getItem(PET_FUNNEL_SESSION_KEY)).toBe(first);
  });

  it("does not store PII, image data, tokens, or fbclid", () => {
    const payload = buildInternalFunnelPayload({
      eventName: "landing_view",
      species: "dog",
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/@/);
    expect(serialized).not.toContain("fbclid");
    expect(serialized).not.toContain("secretclick");
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("pet_name");
    expect(payload).not.toHaveProperty("photo");
    expect(payload.p_utm_campaign).toBe("secret-lives");
    expect(payload.p_campaign_id).toBe("111");
    expect(payload.p_ad_id).toBe("333");
    expect(payload.p_species).toBe("dog");
    expect(payload.p_device_type).toBe("mobile");
  });

  it("posts first-party events with keepalive and the anon key", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = async (input: string | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init || {} });
      return new Response(JSON.stringify(null), { status: 200 });
    };
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchMock });
    const { trackPetFunnelInternalEvent } = await import("./funnelInternal");
    trackPetFunnelInternalEvent({ eventName: "pet_name_submitted", species: "dog" });
    await Promise.resolve();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/rest/v1/rpc/record_pet_funnel_event");
    expect(calls[0].init.keepalive).toBe(true);
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.apikey).toBeTruthy();
    expect(headers.Authorization).toBe(`Bearer ${headers.apikey}`);
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.p_event_name).toBe("pet_name_submitted");
  });

  it("does not depend on a dynamic supabase import that can be cancelled on navigation", () => {
    const src = readFileSync(resolve(root, "src/features/pet/funnelInternal.ts"), "utf8");
    expect(src).toContain("keepalive: true");
    expect(src).toContain("record_pet_funnel_event");
    expect(src).not.toContain('import("@/lib/supabase")');
  });

  it("rejects unknown event names", () => {
    expect(() =>
      buildInternalFunnelPayload({
        eventName: "ViewContent" as never,
      }),
    ).toThrow(/Unsupported/);
  });

  it("classifies device types without a geo lookup", () => {
    expect(inferDeviceType("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(inferDeviceType("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)")).toBe("desktop");
  });
});
