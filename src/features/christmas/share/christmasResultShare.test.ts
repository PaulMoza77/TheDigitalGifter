import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildResultSharePath,
  isGenerationId,
  isShareToken,
  sanitizeResultShareAnalyticsMeta,
} from "./shareLogic";

const readSrc = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("durable result share privacy contract", () => {
  it("uses a UUID + high-entropy capability", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const token = "a".repeat(40);
    expect(isGenerationId(id)).toBe(true);
    expect(isShareToken(token)).toBe(true);
    expect(buildResultSharePath(id, token)).toBe(`/share/${id}?token=${token}`);
  });

  it("strips capability/media values from share analytics metadata", () => {
    expect(sanitizeResultShareAnalyticsMeta({
      generation_id: "11111111-1111-4111-8111-111111111111",
      token: "secret",
      result_url: "https://example.com/private.jpg",
      style_key: "classic_christmas",
    })).toEqual({
      generation_id: "11111111-1111-4111-8111-111111111111",
      style_key: "classic_christmas",
    });
  });

  it("stores only a hash server-side and revocation rotates it", () => {
    const migration = readSrc("supabase/migrations/20260909190000_christmas_generation_result_share.sql");
    const edge = readSrc("supabase/functions/christmas-result-share/index.ts");
    expect(migration).toContain("share_token_hash text not null");
    expect(migration).not.toContain("share_token_ciphertext");
    expect(migration).toContain("revoke all on table public.christmas_generation_shares from anon, authenticated, public");
    expect(edge).not.toContain("share_token_ciphertext");
    expect(edge).not.toContain("encryptShareToken");
    expect(edge).toContain("share_token_hash: await sha256Hex(rotated)");
    expect(edge).toContain('asset.storage_bucket !== "christmas-generated"');
    expect(edge).toContain('.eq("order_id", orderId)');
  });

  it("strips the share query before analytics scripts execute", () => {
    const seo = readSrc("server/christmasSeo.mjs");
    expect(seo).toContain("tdg-result-share-privacy-boot");
    expect(seo).toContain("history.replaceState");
    expect(seo).toContain('name="referrer" content="no-referrer"');
    expect(seo).toContain('name="robots" content="noindex,follow"');
  });

  it("routes /share through the existing SEO catch-all without regressing App", () => {
    const wrapper = readSrc("src/pages/seo/SeoPage.tsx");
    const app = readSrc("src/App.tsx");
    expect(wrapper).toContain('pageType === "share"');
    expect(wrapper).toContain("ChristmasResultSharePage");
    expect(app).toContain('path="/:pageType/:slug"');
  });

  it("owner controls never put capability tokens into analytics", () => {
    const analytics = readSrc("src/features/christmas/share/shareAnalytics.ts");
    expect(analytics).toContain("window.location.pathname");
    expect(analytics).not.toContain("window.location.search");
    expect(analytics).not.toContain("share_token");
    expect(analytics).not.toContain("public_token");
  });
});
