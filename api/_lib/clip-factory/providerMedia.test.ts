import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { signMedia, signedPlaybackPath, verifyMediaSignature } from "./mediaSign";
import { mintProviderMediaUrl, PROVIDER_SIGNED_URL_TTL_SEC } from "../publisher/providerMedia";
import { parseClipFactoryMediaRef, stableMediaRef } from "../../../src/features/publisher/mediaUrl";

const KEYS = ["CLIP_FACTORY_SIGNING_SECRET", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (original[key] == null) delete process.env[key];
    else process.env[key] = original[key];
  }
});

describe("clip-factory provider media URLs", () => {
  it("mints a fresh signature with the existing HMAC algorithm and a 1-2h TTL", () => {
    process.env.CLIP_FACTORY_SIGNING_SECRET = "unit-test-signing-secret";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const stable = "/api/clip-factory?action=media&kind=render&id=clip-1";
    const minted = mintProviderMediaUrl(stable, "https://www.thedigitalgifter.com");
    expect(minted.ttlSec).toBe(PROVIDER_SIGNED_URL_TTL_SEC);
    expect(minted.ttlSec).toBeGreaterThanOrEqual(60 * 60);
    expect(minted.ttlSec).toBeLessThanOrEqual(2 * 60 * 60);
    expect(minted.path).toContain("exp=");
    expect(minted.path).toContain("sig=");
    expect(minted.path).not.toContain("unit-test-signing-secret");
    expect(JSON.stringify(minted)).not.toContain("unit-test-signing-secret");
    const parsed = new URL(minted.url);
    expect(parsed.origin).toBe("https://www.thedigitalgifter.com");
    expect(verifyMediaSignature("render:clip-1", parsed.searchParams.get("exp") || "", parsed.searchParams.get("sig") || "")).toBe(
      true,
    );
    const expected = signMedia("render:clip-1", Number(parsed.searchParams.get("exp")));
    expect(parsed.searchParams.get("sig")).toBe(expected);
    expect(signedPlaybackPath("render", "clip-1", 90 * 60)).toContain("kind=render");
  });

  it("leaves public /assets paths unsigned", () => {
    const minted = mintProviderMediaUrl("/assets/christmas/reel.mp4", "https://www.thedigitalgifter.com");
    expect(minted.path).toBe("/assets/christmas/reel.mp4");
    expect(minted.url).toBe("https://www.thedigitalgifter.com/assets/christmas/reel.mp4");
    expect(minted.path).not.toContain("sig=");
  });

  it("never returns signing secrets and strips stale exp/sig before minting", () => {
    process.env.CLIP_FACTORY_SIGNING_SECRET = "another-secret";
    const stale =
      "https://www.thedigitalgifter.com/api/clip-factory?action=media&kind=render&id=clip-2&exp=1&sig=old";
    expect(stableMediaRef(stale)).toBe("/api/clip-factory?action=media&kind=render&id=clip-2");
    expect(parseClipFactoryMediaRef(stale)).toEqual({ kind: "render", id: "clip-2" });
    const minted = mintProviderMediaUrl(stale, "https://www.thedigitalgifter.com");
    expect(minted.path).not.toContain("sig=old");
    expect(minted.url).not.toMatch(/another-secret|SUPABASE_SERVICE_ROLE_KEY|CLIP_FACTORY/);
    const hmac = createHmac("sha256", "another-secret");
    expect(minted.sig).not.toBe(hmac.digest("hex"));
  });
});
