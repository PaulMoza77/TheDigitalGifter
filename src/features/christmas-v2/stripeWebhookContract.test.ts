import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "../../../api/_lib/christmas/stripeSignature";
import { CHRISTMAS_PACK_OFFERS, CHRISTMAS_V2_CURRENCY } from "./offers";

const TEST_WHSEC = "whsec_test_contract_only_not_a_real_secret";

function signBody(rawBody: string, secret: string, timestamp: number): string {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

describe("Christmas V2 Stripe webhook signature contract", () => {
  it("accepts a valid test-mode signature and rejects forged/expired/missing", async () => {
    const rawBody = JSON.stringify({
      id: "evt_test_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1", amount_total: 700, currency: "eur", payment_status: "paid" } },
    });
    const now = Math.floor(Date.now() / 1000);
    const good = signBody(rawBody, TEST_WHSEC, now);
    expect(await verifyStripeSignature(rawBody, good, TEST_WHSEC, { nowSeconds: now })).toBe(true);

    expect(await verifyStripeSignature(rawBody, "", TEST_WHSEC, { nowSeconds: now })).toBe(false);
    expect(await verifyStripeSignature(rawBody, good, "whsec_wrong", { nowSeconds: now })).toBe(false);
    expect(
      await verifyStripeSignature(rawBody, `t=${now},v1=deadbeef`, TEST_WHSEC, { nowSeconds: now }),
    ).toBe(false);
    expect(
      await verifyStripeSignature(rawBody, signBody(rawBody, TEST_WHSEC, now - 600), TEST_WHSEC, {
        nowSeconds: now,
      }),
    ).toBe(false);
    expect(
      await verifyStripeSignature('{"id":"tampered"}', good, TEST_WHSEC, { nowSeconds: now }),
    ).toBe(false);
  });

  it("wires Edge webhook to shared verifier and fails closed without secret", () => {
    const webhook = readFileSync(resolve("supabase/functions/stripe-webhook/index.ts"), "utf8");
    expect(webhook).toContain('from "../_shared/christmas/stripeSignature.ts"');
    expect(webhook).toContain("verifyStripeSignature");
    expect(webhook).toContain("STRIPE_WEBHOOK_SECRET is not configured");
    expect(webhook).toContain("Invalid Stripe signature");
    expect(webhook).toContain("already_processed");
    expect(webhook).toContain("handleChristmasStripeEvent");
    expect(webhook).toContain("handlePetStripeEvent");
  });
});

describe("Christmas V2 checkout payment contract (offline)", () => {
  const nodeFunnel = readFileSync(resolve("api/christmas-funnel.ts"), "utf8");
  const edgeFunnel = readFileSync(resolve("supabase/functions/christmas-funnel/index.ts"), "utf8");
  const edgeFulfill = readFileSync(
    resolve("supabase/functions/_shared/christmas/stripeFulfill.ts"),
    "utf8",
  );

  it("uses one-time payment mode with EUR pack cents and no subscription mode", () => {
    for (const src of [nodeFunnel, edgeFunnel]) {
      expect(src).toContain('params.set("mode", "payment")');
      expect(src).not.toMatch(/params\.set\("mode",\s*"subscription"\)/);
      expect(src).toContain('line_items[0][price_data][currency]", CHRISTMAS_V2_CURRENCY');
      expect(src).toContain("No subscription.");
      expect(src).not.toContain("automatic_tax");
      expect(src).not.toContain("tax_id_collection");
    }
    expect(CHRISTMAS_V2_CURRENCY).toBe("eur");
    expect(CHRISTMAS_PACK_OFFERS.starter.amountCents).toBe(700);
    expect(CHRISTMAS_PACK_OFFERS.magic.amountCents).toBe(1700);
    expect(CHRISTMAS_PACK_OFFERS.ultimate.amountCents).toBe(2700);
  });

  it("confirmStripePayment and webhook fulfill reject empty currency (no soft-default)", () => {
    expect(nodeFunnel).toMatch(/p_currency:\s*asString\(session\?\.currency\)/);
    expect(nodeFunnel).not.toMatch(
      /p_currency:\s*asString\(session\?\.currency\)\s*\|\|\s*CHRISTMAS_V2_CURRENCY/,
    );
    expect(edgeFunnel).toMatch(/p_currency:\s*asString\(session\?\.currency\)/);
    expect(edgeFunnel).not.toMatch(
      /p_currency:\s*asString\(session\?\.currency\)\s*\|\|\s*CHRISTMAS_V2_CURRENCY/,
    );
    expect(edgeFulfill).not.toMatch(
      /fulfill_christmas_v2_order_payment[\s\S]{0,400}\|\|\s*"usd"/,
    );
  });

  it("documents VAT/tax as not configured on Christmas checkout (business decision required)", () => {
    // Measurement only — do not invent VAT rules.
    expect(nodeFunnel.includes("automatic_tax")).toBe(false);
    expect(edgeFunnel.includes("automatic_tax")).toBe(false);
  });

  it("keeps upsell as a separate child order path (no silent rebill of parent)", () => {
    for (const src of [nodeFunnel, edgeFunnel]) {
      expect(src).toContain("createUpsellCheckout");
      expect(src).toContain("parent_order_id");
      expect(src).toContain("Upsells unlock after your starter pack is paid");
    }
  });

  it("marks live Stripe test-mode BLOCKED when sk_test is absent", () => {
    const key = String(process.env.STRIPE_SECRET_KEY || "");
    const isTest = key.startsWith("sk_test_");
    const isLive = key.startsWith("sk_live_");
    expect(isLive).toBe(false);
    expect(isTest).toBe(false);
    expect(key).toBe("");
  });
});
