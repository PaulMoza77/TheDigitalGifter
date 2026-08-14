import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claimPaidOrder, rescheduleFailedJob } from "./stateMachine.ts";
import { authorizeOrderAccess, authorizeUploadAccess, signAccessToken, verifyAccessToken } from "./guestToken.ts";
import { validatePaidStripeSession } from "./stripePayment.ts";
import { simulateTwoSimultaneousRegenerations } from "./regenClaim.ts";
import { chunkPages, cleanupOneRow, cleanupPager, cleanupRowsPaged, isAbandonedUploadCandidate, verifyCleanupPage } from "./cleanup.ts";
import { isServerManagedUploadPath, serverUploadPath } from "./uploadPath.ts";
import { validateImageUpload } from "../imageValidation.ts";
import { checkoutReturnUrls, configuredAppOrigin, requireAccessTokenSecret, resultEmailHref } from "./appOrigin.ts";
import {
  detectStillImageMime,
  isStillImageTemplate,
  reuseExistingPredictionId,
  shouldCreateNewPrediction,
  TEMPLATE_ACTIVE_COLUMN,
} from "./generationRecovery.ts";
import { shouldStampResultEmailedAt, stripeCheckoutIdempotencyKey, stripeExpireSessionPath } from "./stripePayment.ts";

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

describe("upload ownership", () => {
  it("does not let a signed-in user claim a guest upload without a token", () => {
    assert.equal(
      authorizeUploadAccess({
        uploadUserId: null,
        authUserId: "user-1",
        tokenOk: false,
      }),
      false,
    );
    assert.equal(
      authorizeUploadAccess({
        uploadUserId: "user-1",
        authUserId: "user-1",
        tokenOk: false,
      }),
      true,
    );
    assert.equal(
      authorizeUploadAccess({
        uploadUserId: null,
        authUserId: "user-1",
        tokenOk: true,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
      false,
    );
  });
});

describe("server origin urls", () => {
  it("requires ACCESS_TOKEN_SECRET and builds allowlisted return urls without HMAC in the query", () => {
    assert.throws(() => requireAccessTokenSecret(""), /ACCESS_TOKEN_SECRET/);
    const origin = configuredAppOrigin("https://www.thedigitalgifter.com/app");
    assert.equal(origin, "https://www.thedigitalgifter.com");
    const urls = checkoutReturnUrls(origin, {
      orderId: "ord-1",
      generationId: "gen-1",
      redeemCode: "abc",
    });
    assert.equal(urls.successUrl.includes("access_token"), false);
    assert.equal(urls.successUrl.includes("rc=abc"), true);
    const email = resultEmailHref(origin, "ord-1", "hmac-token");
    assert.equal(email.includes("?access_token="), false);
    assert.equal(email.includes("#t=hmac-token"), true);
  });
});

describe("template validation", () => {
  it("rejects missing, inactive, video, or empty-prompt templates without a generic fallback", () => {
    assert.equal(isStillImageTemplate({ exists: false, active: true, type: "image", prompt: "x" }).ok, false);
    assert.equal(isStillImageTemplate({ exists: true, active: false, type: "image", prompt: "x" }).ok, false);
    assert.equal(isStillImageTemplate({ exists: true, active: true, type: "video", prompt: "x" }).ok, false);
    assert.equal(isStillImageTemplate({ exists: true, active: true, type: "image", prompt: "  " }).ok, false);
    const ok = isStillImageTemplate({ exists: true, active: true, type: "image", prompt: "real prompt" });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.prompt, "real prompt");
  });
});

describe("prediction reuse", () => {
  it("reuses an existing prediction id unless it already failed", () => {
    assert.equal(reuseExistingPredictionId("pred_1"), "pred_1");
    assert.equal(shouldCreateNewPrediction("starting"), false);
    assert.equal(shouldCreateNewPrediction("succeeded"), false);
    assert.equal(shouldCreateNewPrediction("failed"), true);
    assert.equal(shouldCreateNewPrediction("canceled"), true);
  });

  it("detects PNG/WebP/JPEG and refuses other bytes as JPEG", () => {
    const png = detectStillImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    assert.equal(png.ok, true);
    if (png.ok) {
      assert.equal(png.mime, "image/png");
      assert.equal(png.ext, "png");
    }
    const jpeg = detectStillImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]));
    assert.equal(jpeg.ok, true);
    if (jpeg.ok) assert.equal(jpeg.mime, "image/jpeg");
    const fake = detectStillImageMime(Uint8Array.from([0x00, 0x01, 0x02, 0x03]));
    assert.equal(fake.ok, false);
  });
});

describe("cleanup failure and retry", () => {
  it("keeps the DB reference when storage fails and clears it after a successful retry", async () => {
    const cleared: string[] = [];
    let fail = true;
    const deleteObject = async () => {
      if (fail) {
        fail = false;
        return { ok: false as const, error: "storage" };
      }
      return { ok: true as const };
    };
    const first = await cleanupOneRow({
      row: { id: "row-1", bucket: "customer-uploads", path: "uploads/a.jpg" },
      deleteObject,
      clearReference: async (id) => {
        cleared.push(id);
        return { ok: true as const };
      },
    });
    assert.equal(first, "retry");
    assert.deepEqual(cleared, []);
    const second = await cleanupOneRow({
      row: { id: "row-1", bucket: "customer-uploads", path: "uploads/a.jpg" },
      deleteObject,
      clearReference: async (id) => {
        cleared.push(id);
        return { ok: true as const };
      },
    });
    assert.equal(second, "cleared");
    assert.deepEqual(cleared, ["row-1"]);
  });

  it("processes more than 200 objects per row without clearing unprocessed rows", async () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({
      id: `row-${i}`,
      bucket: "generated-results",
      path: `orders/o/${i}.jpg`,
    }));
    const deleted: string[] = [];
    const cleared: string[] = [];
    const result = await cleanupRowsPaged({
      rows,
      pageSize: 50,
      deleteObject: async (_bucket, path) => {
        if (path.endsWith("/7.jpg")) return { ok: false as const, error: "storage" };
        deleted.push(path);
        return { ok: true as const };
      },
      clearReference: async (id) => {
        cleared.push(id);
        return { ok: true as const };
      },
    });
    assert.equal(result.pages, 5);
    assert.equal(result.retried, 1);
    assert.equal(result.cleared, 249);
    assert.equal(cleared.includes("row-7"), false);
    assert.equal(cleared.length, 249);
    assert.equal(deleted.length, 249);
  });

  it("does not count cleared when the DB update fails", async () => {
    const action = await cleanupOneRow({
      row: { id: "row-db", bucket: "customer-uploads", path: "uploads/a.jpg" },
      deleteObject: async () => ({ ok: true as const }),
      clearReference: async () => ({ ok: false as const, error: "db update failed" }),
    });
    assert.equal(action, "retry");
  });

  it("purges confirmed expired unconsumed uploads and skips consumed ones", () => {
    const now = "2026-08-14T12:00:00.000Z";
    assert.equal(
      isAbandonedUploadCandidate({
        status: "confirmed",
        consumed_order_id: null,
        expires_at: "2026-08-13T12:00:00.000Z",
        now,
      }),
      true,
    );
    assert.equal(
      isAbandonedUploadCandidate({
        status: "pending_upload",
        consumed_order_id: null,
        expires_at: "2026-08-13T12:00:00.000Z",
        now,
      }),
      true,
    );
    assert.equal(
      isAbandonedUploadCandidate({
        status: "confirmed",
        consumed_order_id: "order-1",
        expires_at: "2026-08-13T12:00:00.000Z",
        now,
      }),
      false,
    );
  });
});

describe("result email stamp", () => {
  it("stamps result_emailed_at only after Resend success", () => {
    assert.equal(shouldStampResultEmailedAt({ ok: true }), true);
    assert.equal(shouldStampResultEmailedAt({ ok: false, skipped: false, error: "500" }), false);
    assert.equal(shouldStampResultEmailedAt({ ok: false, skipped: true, error: "resend_missing" }), false);
  });
});

describe("checkout template and stripe helpers", () => {
  it("uses a single canonical isactive column and Stripe idempotency plus expire", () => {
    assert.equal(TEMPLATE_ACTIVE_COLUMN, "isactive");
    assert.equal(stripeCheckoutIdempotencyKey("ord-1"), "checkout:ord-1");
    assert.equal(stripeExpireSessionPath("cs_test_1"), "/v1/checkout/sessions/cs_test_1/expire");
  });
});

