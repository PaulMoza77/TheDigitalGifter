import { describe, expect, it } from "vitest";
import { PET_PRICE_CENTS, PET_PRODUCT_SKU } from "./types";
import {
  assertUploadAllowed,
  canStartGeneration,
  customerCannotEnumerateByUuid,
  deliveryAllowed,
  isAdminAuthorized,
  metaPurchaseShouldEmit,
  rejectClientPriceTampering,
  replicateCallbackShouldApply,
  retryTargets,
  serverOwnedAmount,
  stripeFulfillmentDecision,
  tokenEnumerationRejected,
} from "./funnelGuards";

describe("pet funnel production guards", () => {
  it("rejects client price tampering and keeps server amount at $59", () => {
    expect(serverOwnedAmount()).toEqual({
      amountCents: 5900,
      currency: "usd",
      sku: PET_PRODUCT_SKU,
    });
    expect(rejectClientPriceTampering({ amountCents: 1 }).ok).toBe(false);
    expect(rejectClientPriceTampering({ amountCents: PET_PRICE_CENTS, sku: "other" }).ok).toBe(false);
    expect(rejectClientPriceTampering({ amountCents: 5900, sku: PET_PRODUCT_SKU }).ok).toBe(true);
  });

  it("rejects invalid upload type and oversized files", () => {
    expect(assertUploadAllowed("application/pdf", 1000).ok).toBe(false);
    expect(assertUploadAllowed("image/jpeg", 16 * 1024 * 1024).ok).toBe(false);
    expect(assertUploadAllowed("image/png", 12 * 1024 * 1024).ok).toBe(true);
    expect(assertUploadAllowed("image/webp", 1).ok).toBe(true);
  });

  it("rejects UUID and short tokens so orders cannot be enumerated", () => {
    const uuid = "11111111-2222-4333-8333-444444444444";
    expect(tokenEnumerationRejected(uuid)).toBe(true);
    expect(tokenEnumerationRejected("short")).toBe(true);
    expect(tokenEnumerationRejected("")).toBe(true);
    expect(tokenEnumerationRejected("a".repeat(64))).toBe(false);
    expect(customerCannotEnumerateByUuid("a".repeat(64), uuid)).toBe(true);
  });

  it("requires admin for mutations and does not treat hiding UI as authorization", () => {
    expect(isAdminAuthorized({ callerIsAdmin: false, mutation: true })).toBe(false);
    expect(isAdminAuthorized({ callerIsAdmin: true, mutation: true })).toBe(true);
  });

  it("blocks generation on unpaid orders", () => {
    expect(canStartGeneration({ paidAt: null, status: "awaiting_payment" }).ok).toBe(false);
    expect(canStartGeneration({ paidAt: "2026-08-16T00:00:00Z", status: "paid" }).ok).toBe(true);
  });

  it("fulfills pet Stripe webhooks only once payment is confirmed and ignores invoice.paid", () => {
    expect(
      stripeFulfillmentDecision({
        eventType: "checkout.session.completed",
        sku: PET_PRODUCT_SKU,
        mode: "payment",
        paymentStatus: "unpaid",
      }).fulfill,
    ).toBe(false);
    expect(
      stripeFulfillmentDecision({
        eventType: "checkout.session.completed",
        sku: PET_PRODUCT_SKU,
        mode: "payment",
        paymentStatus: "paid",
      }).fulfill,
    ).toBe(true);
    expect(
      stripeFulfillmentDecision({
        eventType: "checkout.session.async_payment_succeeded",
        sku: PET_PRODUCT_SKU,
      }).fulfill,
    ).toBe(true);
    expect(
      stripeFulfillmentDecision({
        eventType: "invoice.paid",
        sku: PET_PRODUCT_SKU,
      }).reason,
    ).toBe("invoice_ignored");
    expect(
      stripeFulfillmentDecision({
        eventType: "checkout.session.completed",
        sku: PET_PRODUCT_SKU,
        mode: "subscription",
        paymentStatus: "paid",
      }).fulfill,
    ).toBe(false);
  });

  it("does not apply duplicate Replicate callbacks or regenerate succeeded scenes", () => {
    expect(
      replicateCallbackShouldApply({ alreadyProcessed: true, currentSceneStatus: "generating" }).reason,
    ).toBe("duplicate_callback");
    expect(
      replicateCallbackShouldApply({ alreadyProcessed: false, currentSceneStatus: "succeeded" }).reason,
    ).toBe("already_succeeded");
    expect(
      replicateCallbackShouldApply({ alreadyProcessed: false, currentSceneStatus: "generating" }).apply,
    ).toBe(true);
  });

  it("retries only failed scenes during partial failure", () => {
    const scenes = [
      { sceneKey: "royal-portrait", status: "succeeded" },
      { sceneKey: "astronaut", status: "failed" },
      { sceneKey: "head-chef", status: "ready" },
    ];
    expect(retryTargets(scenes).map((scene) => scene.sceneKey)).toEqual(["astronaut"]);
    expect(retryTargets(scenes, "royal-portrait")).toEqual([]);
  });

  it("requires QC approval before delivery", () => {
    expect(deliveryAllowed({ orderStatus: "awaiting_qc" })).toBe(false);
    expect(deliveryAllowed({ orderStatus: "generating", completedAt: null })).toBe(false);
    expect(deliveryAllowed({ orderStatus: "complete", qcStatus: "approved", completedAt: "now" })).toBe(true);
  });

  it("deduplicates Meta Purchase events by stable event_id", () => {
    expect(
      metaPurchaseShouldEmit({
        alreadySentAt: "2026-08-16T00:00:00Z",
        eventId: "pet_purchase_1",
      }),
    ).toBe(false);
    expect(
      metaPurchaseShouldEmit({
        alreadySentAt: null,
        eventId: "pet_purchase_1",
        requestedEventId: "pet_purchase_1",
      }),
    ).toBe(true);
    expect(
      metaPurchaseShouldEmit({
        alreadySentAt: null,
        eventId: "pet_purchase_1",
        requestedEventId: "pet_purchase_2",
      }),
    ).toBe(false);
  });
});
