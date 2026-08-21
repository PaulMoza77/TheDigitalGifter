import { beforeEach, describe, expect, it } from "vitest";
import {
  captureFunnelAttribution,
  FUNNEL_ATTRIBUTION_STORAGE_KEY,
  getFunnelAttribution,
  parseFunnelAttributionSearch,
  sanitizeAttributionValue,
} from "./funnelAttribution";

function installStorage() {
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
      location: { search: "" },
    },
  });
  return { session, local };
}

describe("funnel attribution", () => {
  beforeEach(() => {
    installStorage();
  });

  it("parses only known keys and ignores invented values", () => {
    expect(
      parseFunnelAttributionSearch(
        "?utm_source=facebook&utm_medium=paid_social&utm_campaign=pets&utm_content=ad-a&utm_term=dogs&fbclid=abc&campaign_id=1&adset_id=2&ad_id=3&gclid=ignore-me",
      ),
    ).toEqual({
      utm_source: "facebook",
      utm_medium: "paid_social",
      utm_campaign: "pets",
      utm_content: "ad-a",
      utm_term: "dogs",
      fbclid: "abc",
      campaign_id: "1",
      adset_id: "2",
      ad_id: "3",
    });
  });

  it("does not invent missing parameters", () => {
    expect(parseFunnelAttributionSearch("?utm_source=facebook")).toEqual({
      utm_source: "facebook",
    });
    expect(parseFunnelAttributionSearch("")).toEqual({});
  });

  it("preserves first-touch values across later navigation", () => {
    captureFunnelAttribution("?utm_source=facebook&ad_id=111");
    captureFunnelAttribution("?utm_source=instagram&ad_id=999&campaign_id=222");
    expect(getFunnelAttribution()).toEqual({
      utm_source: "facebook",
      ad_id: "111",
    });
  });

  it("rejects malformed values without throwing", () => {
    expect(sanitizeAttributionValue("https://evil.test")).toBeNull();
    expect(sanitizeAttributionValue("you@email.com")).toBeNull();
    expect(sanitizeAttributionValue("<script>")).toBeNull();
    expect(() =>
      captureFunnelAttribution("?utm_source=%00bad&campaign_id=<x>&ad_id=ok-1"),
    ).not.toThrow();
    expect(getFunnelAttribution()).toEqual({ ad_id: "ok-1" });
  });

  it("survives corrupt stored JSON", () => {
    window.sessionStorage.setItem(FUNNEL_ATTRIBUTION_STORAGE_KEY, "{not-json");
    window.localStorage.setItem(FUNNEL_ATTRIBUTION_STORAGE_KEY, "[]");
    expect(getFunnelAttribution()).toEqual({});
    expect(captureFunnelAttribution("?utm_medium=paid_social")).toEqual({
      utm_medium: "paid_social",
    });
  });
});
