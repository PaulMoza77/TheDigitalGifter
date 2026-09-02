import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  META_CAPI_STORAGE_KEY,
  buildMetaFbcFromFbclid,
  captureMetaCapiClickIdsFromSearch,
  getMetaCapiClickIds,
  sanitizeMetaClickId,
} from "./metaCookies";

function installBrowser(cookie = "") {
  const session = new Map<string, string>();
  const local = new Map<string, string>();
  let cookieJar = cookie;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (k: string) => session.get(k) ?? null,
        setItem: (k: string, v: string) => session.set(k, v),
        removeItem: (k: string) => session.delete(k),
      },
      localStorage: {
        getItem: (k: string) => local.get(k) ?? null,
        setItem: (k: string, v: string) => local.set(k, v),
        removeItem: (k: string) => local.delete(k),
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return cookieJar;
      },
      set cookie(value: string) {
        const [pair] = String(value).split(";");
        const [name, ...rest] = pair.split("=");
        const next = `${name}=${rest.join("=")}`;
        const parts = cookieJar
          .split(";")
          .map((p) => p.trim())
          .filter(Boolean)
          .filter((p) => !p.startsWith(`${name}=`));
        parts.push(next);
        cookieJar = parts.join("; ");
      },
    },
  });
  return { session, local, getCookie: () => cookieJar };
}

describe("metaCookies for CAPI", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T13:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sanitizes Meta click ids", () => {
    expect(sanitizeMetaClickId("fb.1.123.abc")).toBe("fb.1.123.abc");
    expect(sanitizeMetaClickId("not-fb")).toBeNull();
    expect(sanitizeMetaClickId("fb.1.bad@id")).toBeNull();
    expect(sanitizeMetaClickId("")).toBeNull();
  });

  it("builds _fbc from fbclid without storing raw analytics PII", () => {
    const ts = Date.now();
    expect(buildMetaFbcFromFbclid("AbCdEf123")).toBe(`fb.1.${ts}.AbCdEf123`);
    expect(buildMetaFbcFromFbclid("bad id")).toBeNull();
  });

  it("captures constructed fbc from landing fbclid for later checkout CAPI", () => {
    installBrowser();
    captureMetaCapiClickIdsFromSearch("?utm_source=fb&utm_medium=paid&fbclid=ClickToken99");
    const ids = getMetaCapiClickIds();
    expect(ids.fbc).toBe(`fb.1.${Date.now()}.ClickToken99`);
    expect(ids.hasMetaClick).toBe(true);
    expect(window.sessionStorage.getItem(META_CAPI_STORAGE_KEY)).toContain("ClickToken99");
    expect(window.sessionStorage.getItem(META_CAPI_STORAGE_KEY)).not.toContain("fbclid");
  });

  it("prefers live _fbc/_fbp cookies over constructed values", () => {
    installBrowser("_fbc=fb.1.1.cookieFbc; _fbp=fb.1.2.cookieFbp");
    captureMetaCapiClickIdsFromSearch("?fbclid=landingClick");
    const ids = getMetaCapiClickIds();
    expect(ids.fbc).toBe("fb.1.1.cookieFbc");
    expect(ids.fbp).toBe("fb.1.2.cookieFbp");
  });
});
