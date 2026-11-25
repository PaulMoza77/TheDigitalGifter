import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STORY_OFFER } from "./catalog";
import { assertStoryTransition, canMarkRecipientOpened } from "./lifecycle";
import {
  assertTestSecretKey,
  isStoryTestMetadata,
  resolveStoryStripeMode,
} from "./storyStripePolicy";
import { STORY_PRICE_CENTS, STORY_PRODUCT_KEY } from "./types";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("Mission 02B — durable orders + Stripe TEST policy", () => {
  it("keeps production checkout kill-switch ON in client catalog", () => {
    expect(STORY_OFFER.checkoutEnabled).toBe(false);
    expect(STORY_OFFER.priceCents).toBe(STORY_PRICE_CENTS);
    expect(STORY_OFFER.productKey).toBe(STORY_PRODUCT_KEY);
  });

  it("enforces server-side status transitions", () => {
    expect(assertStoryTransition("DRAFT", "CHECKOUT_PENDING")).toBe(true);
    expect(assertStoryTransition("CHECKOUT_PENDING", "PAID")).toBe(true);
    expect(assertStoryTransition("PAID", "CONTENT_PENDING")).toBe(true);
    expect(assertStoryTransition("SENT", "OPENED")).toBe(true);
    expect(assertStoryTransition("REVIEW_REQUIRED", "OPENED")).toBe(false);
    expect(assertStoryTransition("APPROVED", "OPENED")).toBe(false);
    expect(assertStoryTransition("DRAFT", "PAID")).toBe(false);
  });

  it("never marks recipient OPENED from buyer preview states", () => {
    expect(canMarkRecipientOpened("READY_TO_SEND")).toBe(false);
    expect(canMarkRecipientOpened("APPROVED")).toBe(false);
    expect(canMarkRecipientOpened("REVIEW_REQUIRED")).toBe(false);
    expect(canMarkRecipientOpened("SENT")).toBe(true);
  });

  it("hashes recipient tokens at rest (hash-only storage contract)", () => {
    const plain = randomBytes(24).toString("hex");
    const hash = sha256Hex(plain);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(plain);
    // Migration stores hash length 64 only
    const migration = readSrc(
      "supabase/migrations/20261123010000_christmas_story_durable_orders.sql",
    );
    expect(migration).toContain("token_hash text not null");
    expect(migration).toContain("length(token_hash) = 64");
    expect(migration).not.toMatch(/recipient_token_plain|plaintext_token/);
  });

  it("isolates Stripe TEST and refuses LIVE fallback", () => {
    expect(
      resolveStoryStripeMode({ checkoutEnabled: false, modeEnv: "test" }),
    ).toBe("disabled");
    expect(
      resolveStoryStripeMode({ checkoutEnabled: true, modeEnv: "test" }),
    ).toBe("test");
    expect(
      resolveStoryStripeMode({ checkoutEnabled: true, modeEnv: "live" }),
    ).toBe("disabled");
    expect(assertTestSecretKey("sk_test_123")).toBe(true);
    expect(assertTestSecretKey("sk_live_123")).toBe(false);
    expect(
      isStoryTestMetadata({
        product_family: "christmas_story",
        stripe_mode: "test",
      }),
    ).toBe(true);
    expect(
      isStoryTestMetadata({
        product_family: "christmas",
        stripe_mode: "test",
      }),
    ).toBe(false);
  });

  it("ships dedicated story Edge function and TEST webhook", () => {
    const api = readSrc("supabase/functions/christmas-story/index.ts");
    const stripe = readSrc("supabase/functions/_shared/christmas/storyStripe.ts");
    const wh = readSrc("supabase/functions/christmas-story-stripe-test-webhook/index.ts");
    expect(api).toContain('action === "getRecipientGift"');
    expect(api).toContain('action === "buyerPreview"');
    expect(api).toContain("marksOpened");
    expect(stripe).toContain("STRIPE_TEST_SECRET_KEY");
    expect(stripe).toContain("Never falls back to LIVE");
    expect(stripe).not.toMatch(/Deno\.env\.get\("STRIPE_SECRET_KEY"\)/);
    expect(wh).toContain("STRIPE_TEST_WEBHOOK_SECRET");
    expect(wh).not.toContain('Deno.env.get("STRIPE_WEBHOOK_SECRET")');
    expect(wh).toContain("live_event_rejected");
    expect(wh).toContain("already_processed");
  });

  it("does not alter Santa Call Stripe isolation module", () => {
    const santa = readSrc("supabase/functions/_shared/christmas/santaStripe.ts");
    expect(santa).toContain("resolveSantaStripeCredentials");
    expect(santa).toContain("STRIPE_TEST_SECRET_KEY");
    // Story webhook must not fulfill Santa products
    const wh = readSrc("supabase/functions/christmas-story-stripe-test-webhook/index.ts");
    expect(wh).not.toContain("christmas_santa_voice_call");
    expect(wh).not.toContain("fulfillSantaVoiceCallOrder");
  });

  it("RLS migration revokes anon/authenticated table access", () => {
    const migration = readSrc(
      "supabase/migrations/20261123010000_christmas_story_durable_orders.sql",
    );
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      "revoke all on table public.christmas_story_orders from anon, authenticated, public",
    );
    expect(migration).toContain("christmas-story-source");
    expect(migration).toContain("christmas-story-generated");
    expect(migration).toContain("christmas_story_fulfill_payment");
  });

  it("authoritative prep prices are $34.99 / 149 RON server-side", () => {
    const life = readSrc("supabase/functions/_shared/christmas/storyLifecycle.ts");
    expect(life).toContain("3499");
    expect(life).toContain("14900");
    expect(life).toContain("our_christmas_story");
    expect(life).toContain("storyServerPrice");
    const api = readSrc("supabase/functions/christmas-story/index.ts");
    expect(api).toContain("client_amount_rejected");
    expect(api).toContain("storyServerPrice");
  });
});
