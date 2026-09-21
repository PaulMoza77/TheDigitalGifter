import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveOAuthReturnTo, withAuthError } from "./oauthReturn";
import { AUTH_RETURN_TO_KEY } from "./returnTo";

describe("oauth return helpers", () => {
  it("appends auth_error without dropping the planner path", () => {
    expect(withAuthError("/account/christmas", "exchange_failed")).toBe(
      "/account/christmas?auth_error=exchange_failed",
    );
    expect(withAuthError("/christmas/planner/welcome?token=abc", "oauth_error")).toBe(
      "/christmas/planner/welcome?token=abc&auth_error=oauth_error",
    );
  });

  it("prefers a safe next query then sessionStorage", () => {
    const store = new Map<string, string>([[AUTH_RETURN_TO_KEY, "/account/christmas"]]);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => store.set(key, value),
          removeItem: (key: string) => store.delete(key),
        },
      },
    });
    expect(resolveOAuthReturnTo("code=abc&next=/account/christmas", "/")).toBe("/account/christmas");
    expect(resolveOAuthReturnTo("code=abc&next=https://evil.com", "/")).toBe("/account/christmas");
  });
});

describe("consent and security source contracts", () => {
  it("defaults Google consent to denied and updates after choice", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    expect(html).toContain('analytics_storage: "denied"');
    expect(html).toContain('gtag("consent", "update"');
    expect(html).toContain("__tdgSetCookieConsent");
    expect(html).not.toMatch(/gtag\("consent", "default"[\s\S]*analytics_storage: "granted"/);
    expect(html).not.toContain("https://js.stripe.com");
  });

  it("sends X-Robots-Tag and CSP frame-ancestors from the origin and Caddy edge", () => {
    const origin = readFileSync(resolve(process.cwd(), "server/origin.mjs"), "utf8");
    const caddy = readFileSync(resolve(process.cwd(), "deploy/caddy/Caddyfile.https.ready"), "utf8");
    expect(origin).toContain("applyAccountPrivacyShell");
    expect(origin).toContain('X-Robots-Tag');
    expect(caddy).toContain("frame-ancestors 'self'");
    expect(caddy).toContain('X-Robots-Tag "noindex, nofollow"');
  });
});
