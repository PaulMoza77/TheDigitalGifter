import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claimPaidOrder, rescheduleFailedJob } from "./stateMachine.ts";
import { authorizeOrderAccess, signAccessToken, verifyAccessToken } from "./guestToken.ts";
import { validatePaidStripeSession } from "./stripePayment.ts";
import { simulateTwoSimultaneousRegenerations } from "./regenClaim.ts";
import { chunkPages, cleanupPager, verifyCleanupPage } from "./cleanup.ts";
import { isServerManagedUploadPath, serverUploadPath } from "./uploadPath.ts";
import { validateImageUpload } from "../imageValidation.ts";

describe("claimPaidOrder", () => {
  it("enqueues a job exactly once for a pending order", () => {
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

  it("does not enqueue again when the order is already paid", () => {
    const again = claimPaidOrder({
      eventAlreadyProcessed: false,
      orderStatus: "paid",
    });
    assert.equal(again.kind, "already_paid");
    assert.equal(again.enqueueJob, false);
  });

  it("does not enqueue from a duplicate webhook after generation failure", () => {
    const duplicate = claimPaidOrder({
      eventAlreadyProcessed: true,
      orderStatus: "failed",
    });
    assert.equal(duplicate.enqueueJob, false);
    const retry = rescheduleFailedJob({ attempts: 1, maxAttempts: 3 });
    assert.equal(retry.retry, true);
    assert.equal(retry.status, "queued");
  });
});

describe("guest access token", () => {
  it("rejects unauthorized result access without ownership or token", async () => {
    const secret = "test-secret";
    const token = await signAccessToken(
      { typ: "order", id: "order-1", exp: Math.floor(Date.now() / 1000) + 60 },
      secret,
    );
    const stolen = await verifyAccessToken("not-a-token", secret, { typ: "order", id: "order-1" });
    assert.equal(stolen, null);
    assert.equal(
      authorizeOrderAccess({
        orderUserId: "user-1",
        authUserId: "user-2",
        tokenOk: false,
      }),
      false,
    );
    const verified = await verifyAccessToken(token, secret, { typ: "order", id: "order-1" });
    assert.ok(verified);
    assert.equal(
      authorizeOrderAccess({
        orderUserId: "user-1",
        authUserId: "user-1",
        tokenOk: false,
      }),
      true,
    );
  });
});

describe("stripe amount currency sku", () => {
  it("accepts the MVP still-image payment only", () => {
    const ok = validatePaidStripeSession({
      paymentStatus: "paid",
      amountTotal: 499,
      currency: "eur",
      metadataSku: "still_image_single",
      expectedAmountCents: 499,
      expectedCurrency: "eur",
      expectedSku: "still_image_single",
    });
    assert.equal(ok.ok, true);
  });

  it("rejects amount or sku mismatch", () => {
    const amount = validatePaidStripeSession({
      paymentStatus: "paid",
      amountTotal: 1999,
      currency: "eur",
      metadataSku: "still_image_single",
      expectedAmountCents: 499,
      expectedCurrency: "eur",
      expectedSku: "still_image_single",
    });
    assert.equal(amount.ok, false);
    const sku = validatePaidStripeSession({
      paymentStatus: "paid",
      amountTotal: 499,
      currency: "eur",
      metadataSku: "subscription_pro",
      expectedAmountCents: 499,
      expectedCurrency: "eur",
      expectedSku: "still_image_single",
    });
    assert.equal(sku.ok, false);
  });
});

describe("simultaneous regenerations", () => {
  it("lets only one of two concurrent included regenerations succeed", () => {
    const { first, second } = simulateTwoSimultaneousRegenerations({
      used: 0,
      allowed: 1,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
  });
});

describe("paginated cleanup", () => {
  it("covers more than 200 rows across pages and verifies each page", () => {
    const rows = Array.from({ length: 250 }, (_, i) => `row-${i}`);
    const pages = chunkPages(rows, 200);
    const plan = cleanupPager(rows.length, 200);
    assert.equal(pages.length, 2);
    assert.equal(pages[0].length, 200);
    assert.equal(pages[1].length, 50);
    assert.equal(plan.coversAll, true);
    assert.equal(verifyCleanupPage({ requested: 200, deleted: 200 }).verified, true);
    assert.equal(verifyCleanupPage({ requested: 50, deleted: 50 }).verified, true);
  });
});

describe("server upload path", () => {
  it("ignores client filenames and only allows server-managed paths", () => {
    const path = serverUploadPath("11111111-1111-4111-8111-111111111111", "jpg");
    assert.equal(isServerManagedUploadPath(path), true);
    assert.equal(isServerManagedUploadPath("previews/evil.jpg"), false);
    assert.equal(isServerManagedUploadPath("../etc/passwd"), false);
  });
});

describe("fake file upload", () => {
  it("rejects a text file renamed as jpg", () => {
    const result = validateImageUpload({
      fileName: "photo.jpg",
      reportedMime: "image/jpeg",
      sizeBytes: 1200,
      headerBytes: Uint8Array.from([0x3c, 0x68, 0x74, 0x6d, 0x6c]),
    });
    assert.equal(result.ok, false);
  });
});
