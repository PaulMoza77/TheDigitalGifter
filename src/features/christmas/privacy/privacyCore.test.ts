import { describe, expect, it } from "vitest";
import {
  assertSafeDeliveryEmailUrl,
  isDeliveryRevoked,
  isHighEntropyDeliveryToken,
  isSensitiveAnalyticsKey,
  isUnsafePrivateMediaUrl,
  sanitizeChristmasAnalyticsMetadata,
  scrubOrderMetadataForPersistence,
} from "./privacyCore";

describe("christmas privacy core", () => {
  it("rejects sensitive analytics keys and storage URLs in metadata", () => {
    expect(isSensitiveAnalyticsKey("email")).toBe(true);
    expect(isSensitiveAnalyticsKey("public_token")).toBe(true);
    expect(isSensitiveAnalyticsKey("style_key")).toBe(false);
    const cleaned = sanitizeChristmasAnalyticsMetadata({
      style_key: "cozy",
      email: "a@b.com",
      token: "abcdef",
      result_url: "https://x.supabase.co/storage/v1/object/public/christmas-generated/x.jpg",
      ok_flag: true,
      latency_ms: 12,
    });
    expect(cleaned).toEqual({ style_key: "cozy", ok_flag: true, latency_ms: 12 });
  });

  it("flags raw private storage URLs as unsafe for email", () => {
    expect(
      isUnsafePrivateMediaUrl(
        "https://abc.supabase.co/storage/v1/object/public/christmas-generated/results/1.jpg",
      ),
    ).toBe(true);
    expect(
      assertSafeDeliveryEmailUrl(
        "https://www.thedigitalgifter.com/christmas/photo-generator?token=abc123",
      ).ok,
    ).toBe(true);
  });

  it("scrubs plaintext delivery tokens from metadata", () => {
    expect(
      scrubOrderMetadataForPersistence({
        public_token_hint: "deadbeef".repeat(8),
        portrait_type: "family",
      }),
    ).toEqual({ portrait_type: "family" });
  });

  it("requires high-entropy delivery tokens", () => {
    expect(isHighEntropyDeliveryToken("short")).toBe(false);
    expect(isHighEntropyDeliveryToken("a".repeat(32))).toBe(true);
    expect(isDeliveryRevoked({ delivery_revoked: true })).toBe(true);
    expect(isDeliveryRevoked({})).toBe(false);
  });
});
