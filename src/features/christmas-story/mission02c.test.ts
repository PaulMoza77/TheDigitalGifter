import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STORY_OFFER } from "./catalog";
import { assertStoryTransition } from "./lifecycle";

const root = resolve(import.meta.dirname, "../../..");

function read(rel: string) {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("Mission 02C — staging E2E readiness", () => {
  it("keeps LIVE checkout kill-switch ON", () => {
    expect(STORY_OFFER.checkoutEnabled).toBe(false);
  });

  it("uses hosted Stripe TEST checkout URL (customer-facing)", () => {
    const edge = read("supabase/functions/christmas-story/index.ts");
    expect(edge).toContain('params.set("mode", "payment")');
    expect(edge).toContain("checkoutUrl");
    expect(edge).not.toContain('params.set("ui_mode", "custom")');
    expect(edge).toContain('action === "syncCheckoutStatus"');
    expect(edge).toContain("awaitsWebhook");
    expect(edge).toContain("Never mark PAID here");
  });

  it("never marks PAID from syncCheckoutStatus / session create alone", () => {
    const edge = read("supabase/functions/christmas-story/index.ts");
    expect(edge).toContain('action === "syncCheckoutStatus"');
    expect(edge).toContain("Only christmas-story-stripe-test-webhook fulfills payment");
    // syncCheckoutStatus must not invoke the fulfill RPC itself.
    const syncStart = edge.indexOf('action === "syncCheckoutStatus"');
    const recoveryStart = edge.indexOf('action === "requestBuyerRecovery"');
    const syncBlock = edge.slice(syncStart, recoveryStart);
    expect(syncBlock).not.toContain(".rpc(");
  });

  it("stores recovery challenges as hashes only", () => {
    const edge = read("supabase/functions/christmas-story/index.ts");
    expect(edge).toContain("email_hash");
    expect(edge).toContain("token_hash");
    expect(edge).not.toMatch(/recovery_challenges"\)\.insert\([\s\S]*buyer_email:/);
    const mig = read("supabase/migrations/20261123120000_christmas_story_02c_hardening.sql");
    expect(mig).toContain("christmas_story_recovery_challenges");
    expect(mig).toContain("email_hash");
    expect(mig).toContain("token_hash");
  });

  it("frontend redirects to Stripe hosted URL and syncs return states", () => {
    const creator = read("src/features/christmas-story/components/GiftCreator.tsx");
    expect(creator).toContain("window.location.assign(remote.checkoutUrl)");
    expect(creator).toContain('mirror.status = "CHECKOUT_PENDING"');
    const orderPage = read("src/features/christmas-story/pages/ChristmasStoryOrderPage.tsx");
    expect(orderPage).toContain("syncCheckoutStatus");
    expect(orderPage).toContain("requestBuyerRecovery");
    expect(orderPage).toContain("redeemBuyerRecovery");
    expect(orderPage).toContain("do not invent a successful local order");
  });

  it("recipient path refuses local fallback when API enabled", () => {
    const page = read("src/features/christmas-story/pages/GiftRecipientPage.tsx");
    expect(page).toContain("never");
    expect(page).toContain("fall back to browser-local content");
  });

  it("webhook remains TEST-only and Santa Call untouched", () => {
    const wh = read("supabase/functions/christmas-story-stripe-test-webhook/index.ts");
    expect(wh).toContain("STRIPE_TEST_WEBHOOK_SECRET");
    expect(wh).toContain("live_event_rejected");
    expect(wh).not.toContain("fulfillSantaVoiceCallOrder");
    const santa = read("supabase/functions/santa-call-stripe-test-webhook/index.ts");
    expect(santa).toContain("fulfillSantaVoiceCallOrder");
  });

  it("lifecycle still forbids DRAFT→PAID and allows CHECKOUT_PENDING→PAID", () => {
    expect(assertStoryTransition("DRAFT", "PAID")).toBe(false);
    expect(assertStoryTransition("CHECKOUT_PENDING", "PAID")).toBe(true);
  });

  it("ships isolated DB E2E harness", () => {
    const script = read("scripts/christmas-story-02c-db-e2e.mjs");
    expect(script).toContain("tdg-story-02c-db");
    expect(script).toContain("buyer preview does not OPEN");
    expect(script).toContain("session create leaves unpaid");
  });
});
