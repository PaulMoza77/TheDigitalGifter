import { beforeEach, describe, expect, it } from "vitest";
import { captureFunnelAttribution } from "./funnelAttribution";
import { buildInternalFunnelPayload } from "./funnelInternal";
import { getPetFunnelSessionId, inferDeviceType, PET_FUNNEL_SESSION_KEY } from "./funnelSession";

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
