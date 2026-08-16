import { describe, expect, it } from "vitest";
import { PET_PRICE_CENTS, PET_PRODUCT_SKU } from "./types";
import { readImageSize } from "./imageSize";
import {
  applyPetPaymentEvent,
  applyPredictionCreateFailure,
  assertUploadAllowed,
  attachCheckoutSessionCas,
  canReleaseDelivery,
  canStartGeneration,
  customerCannotEnumerateByUuid,
  decideCheckoutSessionAction,
  deliveryAllowed,
  fulfillmentAcceptsIssuedSession,
  generationBatchState,
  isAdminAuthorized,
  kontextProInput,
  matchedOpenCheckoutResponse,
  metaPurchaseShouldEmit,
  rejectClientPriceTampering,
  replicateCallbackShouldApply,
  requirePetTokenEncryptionKey,
  retryTargets,
  serverOwnedAmount,
  stripeCheckoutIdempotencyKey,
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

  it("uses a stable Stripe idempotency key and reuses an open checkout session", () => {
    const orderId = "11111111-2222-4333-8333-444444444444";
    expect(stripeCheckoutIdempotencyKey(orderId)).toBe(`pet-checkout-${orderId}`);
    expect(stripeCheckoutIdempotencyKey(orderId, 0)).toBe(stripeCheckoutIdempotencyKey(orderId));
    const open = decideCheckoutSessionAction({
      existingSession: {
        id: "cs_open",
        status: "open",
        url: "https://checkout.stripe.com/c/pay/cs_open",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
      orderId,
      issuedCount: 1,
    });
    expect(open).toEqual({
      action: "reuse",
      sessionId: "cs_open",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_open",
    });
    const duplicateCreate = decideCheckoutSessionAction({
      existingSession: null,
      orderId,
      issuedCount: 0,
    });
    const concurrentCreate = decideCheckoutSessionAction({
      existingSession: null,
      orderId,
      issuedCount: 0,
    });
    expect(duplicateCreate).toEqual(concurrentCreate);
    expect(duplicateCreate).toEqual({
      action: "create",
      idempotencyKey: `pet-checkout-${orderId}`,
      expectedSessionId: null,
    });
  });

  it("replaces an expired stored session with expected-value CAS", () => {
    const orderId = "order-expired";
    const decision = decideCheckoutSessionAction({
      existingSession: { id: "cs_old", status: "expired", url: null },
      orderId,
      issuedCount: 1,
    });
    expect(decision).toEqual({
      action: "create",
      idempotencyKey: `pet-checkout-${orderId}-1`,
      expectedSessionId: "cs_old",
    });
    const replaced = attachCheckoutSessionCas({
      storedSessionId: "cs_old",
      incomingSessionId: "cs_new",
      expectedSessionId: "cs_old",
    });
    expect(replaced).toEqual({ storedSessionId: "cs_new", attached: true });
  });

  it("keeps one winner when two replacements race", () => {
    const first = attachCheckoutSessionCas({
      storedSessionId: "cs_old",
      incomingSessionId: "cs_a",
      expectedSessionId: "cs_old",
    });
    const second = attachCheckoutSessionCas({
      storedSessionId: first.storedSessionId,
      incomingSessionId: "cs_b",
      expectedSessionId: "cs_old",
    });
    expect(first).toEqual({ storedSessionId: "cs_a", attached: true });
    expect(second).toEqual({ storedSessionId: "cs_a", attached: false });
    const createFirst = attachCheckoutSessionCas({
      storedSessionId: null,
      incomingSessionId: "cs_first",
      expectedSessionId: null,
    });
    const createSecond = attachCheckoutSessionCas({
      storedSessionId: createFirst.storedSessionId,
      incomingSessionId: "cs_second",
      expectedSessionId: null,
    });
    expect(createFirst).toEqual({ storedSessionId: "cs_first", attached: true });
    expect(createSecond).toEqual({ storedSessionId: "cs_first", attached: false });
  });

  it("returns a matching sessionId and checkoutUrl or a recoverable conflict", () => {
    expect(
      matchedOpenCheckoutResponse({
        id: "cs_1",
        status: "open",
        url: "https://checkout.stripe.com/c/pay/cs_1",
      }),
    ).toEqual({
      ok: true,
      sessionId: "cs_1",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_1",
    });
    expect(
      matchedOpenCheckoutResponse({
        id: "cs_winner",
        status: "open",
        url: "https://checkout.stripe.com/c/pay/cs_other",
      }),
    ).toEqual({ ok: false, reason: "conflict" });
    expect(
      matchedOpenCheckoutResponse({
        id: "cs_winner",
        status: "expired",
        url: "https://checkout.stripe.com/c/pay/cs_winner",
      }),
    ).toEqual({ ok: false, reason: "conflict" });
  });

  it("does not create another checkout for complete or async payment-pending sessions", () => {
    const orderId = "order-paid";
    expect(
      decideCheckoutSessionAction({
        existingSession: {
          id: "cs_complete",
          status: "complete",
          payment_status: "paid",
          url: "https://checkout.stripe.com/c/pay/cs_complete",
        },
        orderId,
        issuedCount: 1,
      }),
    ).toEqual({ action: "payment_processing", sessionId: "cs_complete" });
    expect(
      decideCheckoutSessionAction({
        existingSession: {
          id: "cs_async",
          status: "complete",
          payment_status: "unpaid",
          url: "https://checkout.stripe.com/c/pay/cs_async",
        },
        orderId,
        issuedCount: 1,
      }),
    ).toEqual({ action: "payment_processing", sessionId: "cs_async" });
  });

  it("fulfills an older issued session exactly once after a replacement", () => {
    const issued = ["cs_old", "cs_new"];
    const first = applyPetPaymentEvent({
      alreadyPaid: false,
      orderId: "order-1",
      metadataOrderId: "order-1",
      paidSessionId: "cs_old",
      issuedSessionIds: issued,
    });
    expect(first).toEqual({ alreadyPaid: true, fulfilledThisEvent: true });
    const duplicate = applyPetPaymentEvent({
      alreadyPaid: first.alreadyPaid,
      orderId: "order-1",
      metadataOrderId: "order-1",
      paidSessionId: "cs_old",
      issuedSessionIds: issued,
    });
    expect(duplicate).toEqual({ alreadyPaid: true, fulfilledThisEvent: false });
    const newer = applyPetPaymentEvent({
      alreadyPaid: duplicate.alreadyPaid,
      orderId: "order-1",
      metadataOrderId: "order-1",
      paidSessionId: "cs_new",
      issuedSessionIds: issued,
    });
    expect(newer).toEqual({ alreadyPaid: true, fulfilledThisEvent: false });
    expect(
      fulfillmentAcceptsIssuedSession({
        orderId: "order-1",
        metadataOrderId: "order-1",
        paidSessionId: "cs_old",
        issuedSessionIds: issued,
      }),
    ).toBe(true);
  });

  it("cannot release a paid order with 0, 11, or partially failed scenes, including markComplete", () => {
    const paid = "2026-08-16T00:00:00Z";
    expect(canReleaseDelivery({ paidAt: paid, orderStatus: "awaiting_qc", scenes: [] }).ok).toBe(false);
    expect(
      canReleaseDelivery({
        paidAt: paid,
        orderStatus: "awaiting_qc",
        scenes: Array.from({ length: 11 }, () => ({ status: "succeeded" })),
      }).ok,
    ).toBe(false);
    expect(
      canReleaseDelivery({
        paidAt: paid,
        orderStatus: "awaiting_qc",
        scenes: [
          ...Array.from({ length: 11 }, () => ({ status: "succeeded" })),
          { status: "failed" },
        ],
      }).ok,
    ).toBe(false);
    expect(
      canReleaseDelivery({
        paidAt: paid,
        orderStatus: "paid",
        scenes: Array.from({ length: 12 }, () => ({ status: "succeeded" })),
      }).ok,
    ).toBe(false);
    expect(
      canReleaseDelivery({
        paidAt: paid,
        orderStatus: "awaiting_qc",
        scenes: Array.from({ length: 12 }, () => ({ status: "succeeded" })),
      }).ok,
    ).toBe(true);
  });

  it("sends only Kontext Pro inputs and recovers when one prediction create fails", () => {
    const input = kontextProInput("a prompt", "https://signed.example/pet.jpg");
    expect(input).toEqual({
      prompt: "a prompt",
      input_image: "https://signed.example/pet.jpg",
      aspect_ratio: "4:5",
      output_format: "jpg",
    });
    expect("image" in input).toBe(false);
    const started = [
      { sceneKey: "royal-portrait", status: "generating", lastError: null },
      { sceneKey: "astronaut", status: "generating", lastError: null },
      { sceneKey: "head-chef", status: "generating", lastError: null },
    ];
    const afterOneFailure = applyPredictionCreateFailure({
      scenes: started,
      failedSceneKey: "astronaut",
      error: "Replicate rejected unsupported input",
    });
    expect(afterOneFailure.find((scene) => scene.sceneKey === "astronaut")).toEqual({
      sceneKey: "astronaut",
      status: "failed",
      lastError: "Replicate rejected unsupported input",
    });
    expect(afterOneFailure.find((scene) => scene.sceneKey === "royal-portrait")?.status).toBe("generating");
    expect(afterOneFailure.find((scene) => scene.sceneKey === "head-chef")?.status).toBe("generating");
    const terminal = afterOneFailure.map((scene) =>
      scene.sceneKey === "astronaut" ? scene : { ...scene, status: "succeeded" },
    );
    expect(generationBatchState(terminal)).toBe("partial_failure");
  });

  it("requires PET_TOKEN_ENCRYPTION_KEY and does not fall back to the service-role key", () => {
    expect(() =>
      requirePetTokenEncryptionKey((name) => (name === "SUPABASE_SERVICE_ROLE_KEY" ? "service-role-secret-key-value" : "")),
    ).toThrow(/PET_TOKEN_ENCRYPTION_KEY is required/);
    expect(() => requirePetTokenEncryptionKey(() => "short-key")).toThrow(/PET_TOKEN_ENCRYPTION_KEY is required/);
    expect(
      requirePetTokenEncryptionKey((name) =>
        name === "PET_TOKEN_ENCRYPTION_KEY" ? "pet-token-encryption-key-32chars!!" : "service-role",
      ),
    ).toBe("pet-token-encryption-key-32chars!!");
  });

  it("reads real image dimensions instead of assuming 2400x3000", () => {
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03, 0x08, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00,
    ]);
    expect(readImageSize(png)).toEqual({ width: 2, height: 3 });
  });
});
