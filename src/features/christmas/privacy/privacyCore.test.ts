import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertSafeDeliveryEmailUrl,
  buildCheckoutOrderMetadata,
  getOrderProjectionLeaksSecrets,
  isDeliveryRevoked,
  isHighEntropyDeliveryToken,
  isSensitiveAnalyticsKey,
  isUnsafePrivateMediaUrl,
  projectSafeChristmasOrder,
  requireTokenProofForExistingOrder,
  sanitizeChristmasAnalyticsMetadata,
  scrubOrderMetadataForPersistence,
} from "./privacyCore";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

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
    const meta = buildCheckoutOrderMetadata({
      portraitType: "family",
      species: null,
      sourceRoute: "/christmas/family",
    });
    expect(meta).not.toHaveProperty("public_token_hint");
    expect(meta).not.toHaveProperty("public_token");
    expect(meta.source).toBe("christmas-checkout");
  });

  it("requires token proof to update an existing unpaid order", () => {
    expect(requireTokenProofForExistingOrder({ existingOrderId: null }).ok).toBe(true);
    expect(
      requireTokenProofForExistingOrder({
        existingOrderId: "11111111-1111-4111-8111-111111111111",
        publicToken: "short",
      }).ok,
    ).toBe(false);
    expect(
      requireTokenProofForExistingOrder({
        existingOrderId: "11111111-1111-4111-8111-111111111111",
        publicToken: "a".repeat(32),
      }).ok,
    ).toBe(true);
  });

  it("requires high-entropy delivery tokens and honors revoke", () => {
    expect(isHighEntropyDeliveryToken("short")).toBe(false);
    expect(isHighEntropyDeliveryToken("a".repeat(32))).toBe(true);
    expect(isDeliveryRevoked({ delivery_revoked: true })).toBe(true);
    expect(isDeliveryRevoked({})).toBe(false);
  });

  it("getOrder projection omits tokens, email, and metadata", () => {
    const projection = projectSafeChristmasOrder(
      {
        id: "ord_1",
        product_key: "christmas_photo",
        package_key: "single",
        style_key: "cozy",
        payment_status: "paid",
        fulfillment_status: "completed",
        amount_cents: 1500,
        currency: "eur",
        last_error: null,
        metadata: { public_token_hint: "deadbeef".repeat(8) },
        public_token_ciphertext: "YQ==",
        public_token_hash: "abc",
        email: "a@b.com",
        source_path: "uploads/secret.jpg",
      },
      "https://example.com/signed",
    );
    expect(projection.resultUrl).toBe("https://example.com/signed");
    expect(getOrderProjectionLeaksSecrets(projection as unknown as Record<string, unknown>)).toBe(
      false,
    );
    expect(JSON.stringify(projection)).not.toMatch(/deadbeef|a@b.com|uploads\/secret/);
  });
});

describe("christmas privacy wiring", () => {
  it("checkout stores ciphertext only and requires token proof", () => {
    const checkout = readSrc("supabase/functions/christmas-checkout/index.ts");
    expect(checkout).not.toContain("public_token_hint");
    expect(checkout).toContain("public_token_ciphertext");
    expect(checkout).toContain("token_required");
    expect(checkout).toContain("encryptPublicToken");
    expect(checkout).toMatch(/public_token_hash[\s\S]*proofHash/);
  });

  it("getOrder returns a private cache-safe projection", () => {
    const cors = readSrc("supabase/functions/_shared/cors.ts");
    expect(cors).toContain("private, no-store");
    expect(cors).toContain("function privateJsonResponse");
    const photo = readSrc("supabase/functions/christmas-photo-funnel/index.ts");
    const santa = readSrc("supabase/functions/christmas-santa-funnel/index.ts");
    for (const src of [photo, santa]) {
      expect(src).toContain("privateJsonResponse");
      expect(src).toContain("delivery_revoked");
      expect(src).not.toMatch(/return (privateJsonResponse|jsonResponse)\(\{[\s\S]*\.\.\.order/);
    }
  });

  it("generation emails resolve tokens from ciphertext", () => {
    const photoGen = readSrc("supabase/functions/christmas-photo-generate/index.ts");
    const santaGen = readSrc("supabase/functions/christmas-santa-generate/index.ts");
    expect(photoGen).toContain("resolveDeliveryToken");
    expect(santaGen).toContain("resolveDeliveryToken");
    expect(photoGen).not.toContain("public_token_hint");
    expect(santaGen).not.toContain("public_token_hint");
  });

  it("kids shell and account routes are noindex", () => {
    expect(readSrc("src/features/christmas/components/ChristmasFeatureShell.tsx")).toContain(
      "noindex={shell.noindex}",
    );
    expect(readSrc("src/layouts/ClientLayout.tsx")).toMatch(/noindex,nofollow/);
  });
});
