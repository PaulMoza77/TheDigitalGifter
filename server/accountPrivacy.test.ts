import { describe, expect, it } from "vitest";
import { applyAccountPrivacyShell, isPrivateAccountPath } from "./accountPrivacy.mjs";

const template = `<!doctype html><html><head>
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="https://www.thedigitalgifter.com/" />
  </head><body></body></html>`;

describe("account privacy HTML", () => {
  it("treats /account and nested planner URLs as private", () => {
    expect(isPrivateAccountPath("/account")).toBe(true);
    expect(isPrivateAccountPath("/account/christmas")).toBe(true);
    expect(isPrivateAccountPath("/account/christmas/gifts")).toBe(true);
    expect(isPrivateAccountPath("/christmas")).toBe(false);
    expect(isPrivateAccountPath("/")).toBe(false);
  });

  it("rewrites SPA index robots and homepage canonical for /account/christmas", () => {
    const html = applyAccountPrivacyShell(template, "/account/christmas");
    expect(html).toContain('name="robots" content="noindex,nofollow"');
    expect(html).toContain('rel="canonical" href="https://www.thedigitalgifter.com/account/christmas"');
    expect(html).not.toContain('href="https://www.thedigitalgifter.com/"');
  });
});
