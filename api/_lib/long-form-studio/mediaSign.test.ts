import { afterEach, describe, expect, it } from "vitest";
import { signLongFormMedia, verifyLongFormSignature } from "./mediaSign";

const KEYS = ["LONG_FORM_SIGNING_SECRET", "CLIP_FACTORY_SIGNING_SECRET", "SUPABASE_SERVICE_ROLE_KEY"] as const;

describe("long-form media signatures", () => {
  const previous: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of KEYS) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it("refuses a missing secret instead of using a hardcoded fallback", () => {
    for (const key of KEYS) {
      previous[key] = process.env[key];
      delete process.env[key];
    }
    expect(() => signLongFormMedia("video:abc", Math.floor(Date.now() / 1000) + 60)).toThrow(/not configured/i);
  });

  it("rejects expired and tampered signatures", () => {
    for (const key of KEYS) previous[key] = process.env[key];
    process.env.LONG_FORM_SIGNING_SECRET = "unit-test-signing-secret-value";
    const exp = Math.floor(Date.now() / 1000) + 120;
    const sig = signLongFormMedia("video:abc", exp);
    expect(verifyLongFormSignature("video:abc", exp, sig)).toBe(true);
    const tampered = `${sig.slice(0, -2)}aa`;
    expect(verifyLongFormSignature("video:abc", exp, tampered)).toBe(false);
    expect(verifyLongFormSignature("video:abc", Math.floor(Date.now() / 1000) - 10, sig)).toBe(false);
  });
});
