import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canUseIncludedRegeneration,
  claimGenerationStart,
  claimPaidOrder,
} from "./stateMachine.ts";

describe("claimPaidOrder", () => {
  it("starts generation exactly once for a pending order", () => {
    const first = claimPaidOrder({
      eventAlreadyProcessed: false,
      orderStatus: "pending",
    });
    assert.equal(first.kind, "claimed");
    assert.equal(first.enqueueJob, true);
  });

  it("ignores a duplicated Stripe webhook event", () => {
    const again = claimPaidOrder({
      eventAlreadyProcessed: true,
      orderStatus: "paid",
    });
    assert.equal(again.kind, "duplicate_event");
    assert.equal(again.enqueueJob, false);
  });

  it("does not start a second generation when the order is already paid", () => {
    const again = claimPaidOrder({
      eventAlreadyProcessed: false,
      orderStatus: "paid",
    });
    assert.equal(again.kind, "already_paid");
    assert.equal(again.enqueueJob, false);
  });
});

describe("claimGenerationStart", () => {
  it("claims a pending generation", () => {
    const result = claimGenerationStart({
      generationStatus: "pending",
      attemptCount: 0,
      maxAttempts: 3,
    });
    assert.equal(result.runGeneration, true);
    assert.equal(result.kind, "claimed");
  });

  it("does not duplicate an in-flight generation", () => {
    const result = claimGenerationStart({
      generationStatus: "processing",
      attemptCount: 1,
      maxAttempts: 3,
    });
    assert.equal(result.runGeneration, false);
    assert.equal(result.kind, "already_running");
  });

  it("allows a failed generation to retry under the attempt cap", () => {
    const result = claimGenerationStart({
      generationStatus: "failed",
      attemptCount: 1,
      maxAttempts: 3,
    });
    assert.equal(result.runGeneration, true);
    assert.equal(result.kind, "retry_allowed");
  });

  it("blocks retries after the attempt cap", () => {
    const result = claimGenerationStart({
      generationStatus: "failed",
      attemptCount: 3,
      maxAttempts: 3,
    });
    assert.equal(result.runGeneration, false);
    assert.equal(result.kind, "blocked");
  });
});

describe("canUseIncludedRegeneration", () => {
  it("allows one included regeneration on a completed order", () => {
    assert.equal(
      canUseIncludedRegeneration({
        orderStatus: "completed",
        allowed: 1,
        used: 0,
      }),
      true,
    );
  });

  it("blocks a second included regeneration", () => {
    assert.equal(
      canUseIncludedRegeneration({
        orderStatus: "completed",
        allowed: 1,
        used: 1,
      }),
      false,
    );
  });
});
