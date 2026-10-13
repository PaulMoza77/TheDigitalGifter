import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("Memories V1 wiring", () => {
  it("registers SPA routes", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/memories"');
    expect(app).toContain('path="/memories/create"');
    expect(app).toContain('path="/memories/plans"');
    expect(app).toContain('path="/memories/success"');
    expect(app).toContain('path="memories"');
  });

  it("registers origin API modules", () => {
    const routes = readSrc("server/routes.mjs");
    expect(routes).toContain('"/api/memories-funnel"');
    expect(routes).toContain('"/api/memories-funnel-event"');
  });

  it("wires Stripe webhook for Memories before Christmas/pet", () => {
    const webhook = readSrc("supabase/functions/stripe-webhook/index.ts");
    expect(webhook).toContain("handleMemoriesStripeEvent");
    expect(webhook).toContain("customer.subscription.created");
    expect(webhook).toContain("invoice.payment_failed");
    const memoriesIdx = webhook.indexOf("await handleMemoriesStripeEvent");
    const christmasIdx = webhook.indexOf("await handleChristmasStripeEvent");
    expect(memoriesIdx).toBeGreaterThan(-1);
    expect(christmasIdx).toBeGreaterThan(memoriesIdx);
  });

  it("defaults commercial mode to waitlist and avoids live price creation", () => {
    const constants = readSrc("supabase/functions/_shared/memories/constants.ts");
    expect(constants).toContain('|| "waitlist"');
    expect(constants).toContain("paid_early_access");
    const funnel = readSrc("supabase/functions/memories-funnel/index.ts");
    expect(funnel).toContain('params.set("mode", "subscription")');
    expect(funnel).toContain("product_family");
    expect(funnel).toContain("MEMORIES_PRODUCT_FAMILY");
  });

  it("includes migration for memories domain", () => {
    const migration = readSrc("supabase/migrations/20261012190000_memories_v1_funnel.sql");
    expect(migration).toContain("memories_orders");
    expect(migration).toContain("memories_subscriptions");
    expect(migration).toContain("MEMORIES_FIRST_SALE_VERIFIED");
    expect(migration).toContain("memories-source-photos");
    expect(migration).toContain("fulfill_memories_subscription_payment");
  });

  it("does not modify Christmas pack prices", () => {
    const christmas = readSrc("src/features/christmas-v2/config.ts");
    expect(christmas).toContain("CHRISTMAS_STARTER_PRICE_CENTS = 300");
    expect(christmas).toContain("CHRISTMAS_MAGIC_PRICE_CENTS = 800");
  });

  it("ships real Memories demo stills and hero after clip", () => {
    const landing = readSrc("src/features/memories/screens/LandingScreen.tsx");
    expect(landing).toContain("MEMORIES_HERO_DEMO");
    expect(landing).toContain("afterVideo");
    expect(landing).toContain("Before · still");
    expect(landing).toContain("After · short clip");
    const before = readFileSync(resolve(process.cwd(), "public/assets/memories/demo-before.jpg"));
    const after = readFileSync(resolve(process.cwd(), "public/assets/memories/demo-after.mp4"));
    const g1 = readFileSync(resolve(process.cwd(), "public/assets/memories/gallery-1.jpg"));
    expect(before.byteLength).toBeGreaterThan(80_000);
    expect(after.byteLength).toBeGreaterThan(500_000);
    expect(g1.byteLength).toBeGreaterThan(80_000);
  });
});
