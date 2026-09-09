import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "../funnelEventContract";
import {
  buildResultSharePath,
  isGenerationId,
  isShareToken,
  looksLikeMediaUrl,
  parseShareTokenFromSearch,
  productCtaForShare,
  sanitizeResultShareAnalyticsMeta,
} from "./shareLogic";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("result share URL contract", () => {
  it("builds a tokenized /share/[generationId] path", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const token = "a".repeat(40);
    expect(buildResultSharePath(id, token)).toBe(`/share/${id}?token=${token}`);
    expect(isGenerationId(id)).toBe(true);
    expect(isShareToken(token)).toBe(true);
    expect(isShareToken("short")).toBe(false);
    expect(isGenerationId("not-a-uuid")).toBe(false);
  });

  it("reads token from query and rejects missing tokens", () => {
    expect(parseShareTokenFromSearch("?token=" + "b".repeat(32))).toHaveLength(32);
    expect(parseShareTokenFromSearch("?t=" + "c".repeat(32))).toHaveLength(32);
    expect(parseShareTokenFromSearch("")).toBeNull();
    expect(parseShareTokenFromSearch("?token=abc")).toBeNull();
  });
});

describe("result share analytics privacy", () => {
  it("strips media URLs and capability tokens", () => {
    const clean = sanitizeResultShareAnalyticsMeta({
      generation_id: "11111111-1111-4111-8111-111111111111",
      asset_kind: "image",
      resultUrl: "https://example.supabase.co/storage/v1/object/sign/christmas-generated/x.jpg",
      signed_url: "https://cdn.example/file.jpg",
      token: "secret-token-value-1234567890",
      public_token: "owner-token",
      style_key: "classic_christmas",
    });
    expect(clean).toEqual({
      generation_id: "11111111-1111-4111-8111-111111111111",
      asset_kind: "image",
      style_key: "classic_christmas",
    });
    expect(looksLikeMediaUrl("https://x/y.jpg")).toBe(true);
    expect(looksLikeMediaUrl("classic_christmas")).toBe(false);
  });
});

describe("result share product CTA", () => {
  it("maps known products and falls back to photo generator", () => {
    expect(productCtaForShare("christmas_santa_video").to).toBe("/christmas/santa-video");
    expect(productCtaForShare("unknown").to).toBe("/christmas/photo-generator");
  });
});

describe("result share wiring", () => {
  it("App registers /share/:generationId before the SEO catch-all", () => {
    const app = readSrc("src/App.tsx");
    const share = app.indexOf('path="/share/:generationId"');
    const seo = app.indexOf('path="/:pageType/:slug"');
    expect(share).toBeGreaterThan(-1);
    expect(seo).toBeGreaterThan(share);
    expect(app).toContain("ChristmasResultSharePage");
  });

  it("migration is private-by-default and service-mediated", () => {
    const sql = readSrc("supabase/migrations/20260909190000_christmas_generation_result_share.sql");
    expect(sql).toContain("christmas_generation_shares");
    expect(sql).toContain("share_enabled boolean not null default false");
    expect(sql).toContain("share_token_hash");
    expect(sql).toContain("revoke all on table public.christmas_generation_shares from anon");
    expect(sql).not.toMatch(/grant select on table public\.christmas_generation_shares to anon/);
  });

  it("edge function token-gates public read and supports revoke", () => {
    const fn = readSrc("supabase/functions/christmas-result-share/index.ts");
    expect(fn).toContain('action === "getSharedResult"');
    expect(fn).toContain('action === "enableShare"');
    expect(fn).toContain('action === "revokeShare"');
    expect(fn).toContain("share_token_hash");
    expect(fn).toContain("getServiceClient");
    expect(fn).toContain("share_enabled: false");
    expect(fn).not.toContain("mock");
    expect(fn).not.toMatch(/share_id.*enableShare|enableShare.*share_id/);
  });

  it("share page is noindex and does not emit media URLs in analytics calls", () => {
    const page = readSrc("src/features/christmas/ChristmasResultSharePage.tsx");
    expect(page).toContain("noindex");
    expect(page).toContain("shared_result_view");
    const trackAt = page.indexOf('trackChristmasEvent("shared_result_view"');
    expect(trackAt).toBeGreaterThan(-1);
    expect(page.slice(trackAt, trackAt + 280)).not.toContain("resultUrl");
    const head = readSrc("src/components/PageHead.tsx");
    expect(head).toContain("noindex,follow");
  });

  it("registers share analytics events", () => {
    for (const ev of ["result_share_enabled", "result_share_revoked", "shared_result_view"]) {
      expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain(ev);
    }
  });

  it("robots.txt blocks /share", () => {
    expect(readSrc("public/robots.txt")).toContain("Disallow: /share");
  });
});
