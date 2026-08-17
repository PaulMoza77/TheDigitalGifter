import { describe, expect, it } from "vitest";
import {
  AI_COST_PROVIDER_REPLICATE,
  AiCostLedgerStore,
  GROSS_AFTER_AI_DISCLAIMER,
  PROJECTED_STANDARD_PACK_COST_USD,
  SEEDANCE_CLIP_COST_USD,
  SEEDANCE_FAST_MODEL,
  SEEDANCE_PRICE_PER_SECOND_USD,
  buildAdminAiCostReport,
  buildOrderCostDetails,
  buildPendingLedgerRow,
  formatUsd,
  formatUsd3,
  mockPredictionId,
  projectedStandardPackCostUsd,
  rangeToIso,
  snapshotSeedanceTariff,
  sumTrackedCostUsd,
} from "./aiCost";
import { PET_PRICE_CENTS, PET_PRODUCT_SKU } from "./types";
import { isAdminAuthorized, rejectClientPriceTampering, stripeFulfillmentDecision } from "./funnelGuards";
import {
  canGenerateVideoClips,
  canIssueSignedVideoUrl,
  canRetryVideoClip,
  canSelectVideoSources,
  customerCannotAccessOtherOrderVideos,
  markCompleteCannotBypass,
  orderRetainsSnapshottedPrice,
  rejectClientVideoTampering,
  rejectUnsignedReplicateWebhook,
  resolveServerOwnedOffer,
  resolveServerOwnedPromo,
  seedanceInput,
  stripeCheckoutIsOneTimePayment,
} from "./videoGuards";

function scene(id: string, status = "succeeded") {
  return { id, orderId: "order-1", status };
}

function twelveScenes(status = "succeeded") {
  return Array.from({ length: 12 }, (_, index) => scene(`scene-${index}`, status));
}

function pendingVideo(input: {
  id: string;
  predictionId: string;
  orderId: string;
  clipId: string;
  attemptNumber?: number;
  isMock?: boolean;
  createFailed?: boolean;
}) {
  return buildPendingLedgerRow({
    id: input.id,
    predictionId: input.predictionId,
    orderId: input.orderId,
    sceneKey: `video-${input.clipId}`,
    attemptNumber: input.attemptNumber ?? 1,
    tariff: snapshotSeedanceTariff({
      capturedAt: "2026-08-16T00:00:00.000Z",
      clipId: input.clipId,
    }),
    startedAt: "2026-08-16T12:00:00.000Z",
    isMock: input.isMock,
    createFailed: input.createFailed,
    mediaType: "video",
    clipId: input.clipId,
  });
}

describe("pet video clips", () => {
  it("1. non-admin cannot select scenes or generate/retry/approve clips", () => {
    expect(isAdminAuthorized({ callerIsAdmin: false, mutation: true })).toBe(false);
    expect(
      canSelectVideoSources({
        callerIsAdmin: false,
        paidAt: "now",
        orderStatus: "awaiting_qc",
        scenes: twelveScenes(),
        selectedSceneIds: ["scene-0", "scene-1"],
        orderId: "order-1",
      }).ok,
    ).toBe(false);
    expect(
      canGenerateVideoClips({
        callerIsAdmin: false,
        paidAt: "now",
        orderStatus: "awaiting_qc",
        scenes: twelveScenes(),
        selectedSceneIds: ["scene-0", "scene-1"],
        orderId: "order-1",
        existingClips: [],
        videoGenerationEnabled: true,
      }).ok,
    ).toBe(false);
    expect(
      canRetryVideoClip({
        callerIsAdmin: false,
        paidAt: "now",
        clip: {
          id: "clip-1",
          petOrderId: "order-1",
          sourceSceneId: "scene-0",
          slot: 1,
          status: "failed",
        },
        orderId: "order-1",
      }).ok,
    ).toBe(false);
  });

  it("2. unpaid order cannot generate clips", () => {
    expect(
      canGenerateVideoClips({
        callerIsAdmin: true,
        paidAt: null,
        orderStatus: "awaiting_payment",
        scenes: twelveScenes(),
        selectedSceneIds: ["scene-0", "scene-1"],
        orderId: "order-1",
        existingClips: [],
        videoGenerationEnabled: true,
      }).code,
    ).toBe("PAYMENT_REQUIRED");
  });

  it("3. fewer than 12 successful images cannot generate clips", () => {
    expect(
      canGenerateVideoClips({
        callerIsAdmin: true,
        paidAt: "now",
        orderStatus: "awaiting_qc",
        scenes: twelveScenes().slice(0, 11),
        selectedSceneIds: ["scene-0", "scene-1"],
        orderId: "order-1",
        existingClips: [],
        videoGenerationEnabled: true,
      }).ok,
    ).toBe(false);
  });

  it("4. admin must select exactly two scenes", () => {
    expect(
      canSelectVideoSources({
        callerIsAdmin: true,
        paidAt: "now",
        orderStatus: "awaiting_qc",
        scenes: twelveScenes(),
        selectedSceneIds: ["scene-0"],
        orderId: "order-1",
      }).ok,
    ).toBe(false);
    expect(
      canSelectVideoSources({
        callerIsAdmin: true,
        paidAt: "now",
        orderStatus: "awaiting_qc",
        scenes: twelveScenes(),
        selectedSceneIds: ["scene-0", "scene-1", "scene-2"],
        orderId: "order-1",
      }).ok,
    ).toBe(false);
  });

  it("5. selected scenes must belong to the same order", () => {
    const scenes = [...twelveScenes(), { id: "other", orderId: "order-2", status: "succeeded" }];
    expect(
      canSelectVideoSources({
        callerIsAdmin: true,
        paidAt: "now",
        orderStatus: "awaiting_qc",
        scenes,
        selectedSceneIds: ["scene-0", "other"],
        orderId: "order-1",
      }).message,
    ).toMatch(/same order/);
  });

  it("6. duplicate Generate action does not create duplicate predictions", () => {
    const first = canGenerateVideoClips({
      callerIsAdmin: true,
      paidAt: "now",
      orderStatus: "selecting_video_scenes",
      scenes: twelveScenes(),
      selectedSceneIds: ["scene-0", "scene-1"],
      orderId: "order-1",
      existingClips: [],
      videoGenerationEnabled: true,
    });
    const duplicate = canGenerateVideoClips({
      callerIsAdmin: true,
      paidAt: "now",
      orderStatus: "generating_videos",
      scenes: twelveScenes(),
      selectedSceneIds: ["scene-0", "scene-1"],
      orderId: "order-1",
      existingClips: [
        {
          id: "clip-1",
          petOrderId: "order-1",
          sourceSceneId: "scene-0",
          slot: 1,
          status: "generating",
          replicatePredictionId: "pred-a",
        },
        {
          id: "clip-2",
          petOrderId: "order-1",
          sourceSceneId: "scene-1",
          slot: 2,
          status: "queued",
          replicatePredictionId: "pred-b",
        },
      ],
      videoGenerationEnabled: true,
    });
    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
  });

  it("7. invalid Replicate signature is rejected", () => {
    expect(
      rejectUnsignedReplicateWebhook({
        webhookId: "msg_1",
        timestamp: "1710000000",
        signature: null,
      }).ok,
    ).toBe(false);
    expect(rejectClientVideoTampering({ predictionId: "pred-1" }).ok).toBe(false);
  });

  it("8-15. video cost ledger accounting", () => {
    const store = new AiCostLedgerStore();
    store.recordAttempt(
      pendingVideo({ id: "v1", predictionId: "pred-v1", orderId: "order-pack", clipId: "clip-1" }),
    );
    store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-v1",
      providerStatus: "succeeded",
      completedAt: "2026-08-16T12:01:00.000Z",
    });
    expect(store.get(AI_COST_PROVIDER_REPLICATE, "pred-v1")?.cost_usd).toBe(SEEDANCE_CLIP_COST_USD);
    expect(formatUsd3(store.get(AI_COST_PROVIDER_REPLICATE, "pred-v1")?.cost_usd || 0)).toBe("$0.125");

    store.recordAttempt(
      pendingVideo({ id: "v1b", predictionId: "pred-v1", orderId: "order-pack", clipId: "clip-1" }),
    );
    store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-v1",
      providerStatus: "succeeded",
      completedAt: "2026-08-16T12:02:00.000Z",
    });
    expect(store.all().filter((row) => row.prediction_id === "pred-v1")).toHaveLength(1);

    store.recordAttempt(
      pendingVideo({ id: "v2", predictionId: "pred-v2", orderId: "order-pack", clipId: "clip-2" }),
    );
    store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-v2",
      providerStatus: "succeeded",
      completedAt: "2026-08-16T12:03:00.000Z",
    });
    expect(sumTrackedCostUsd(store.all().filter((row) => row.media_type === "video"))).toBe(0.25);

    const failed = pendingVideo({
      id: "fail",
      predictionId: "pred-fail",
      orderId: "order-fail",
      clipId: "clip-fail",
    });
    const failStore = new AiCostLedgerStore();
    failStore.recordAttempt(failed);
    failStore.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-fail",
      providerStatus: "failed",
      completedAt: "2026-08-16T12:04:00.000Z",
    });
    expect(failStore.get(AI_COST_PROVIDER_REPLICATE, "pred-fail")?.cost_usd).toBe(0);

    const mock = pendingVideo({
      id: "mock",
      predictionId: mockPredictionId("order-mock", "video-1", 1),
      orderId: "order-mock",
      clipId: "clip-mock",
      isMock: true,
    });
    expect(mock.cost_usd).toBe(0);
    expect(mock.is_mock).toBe(true);

    const cancelStore = new AiCostLedgerStore();
    cancelStore.recordAttempt(
      pendingVideo({ id: "c", predictionId: "pred-c", orderId: "order-c", clipId: "clip-c" }),
    );
    const canceled = cancelStore.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-c",
      providerStatus: "canceled",
      completedAt: "2026-08-16T12:05:00.000Z",
    });
    expect(canceled?.cost_usd).toBe(0.125);
    expect(canceled?.cost_state).toBe("estimated");

    cancelStore.recordAttempt(
      pendingVideo({
        id: "c2",
        predictionId: "pred-c-retry",
        orderId: "order-c",
        clipId: "clip-c",
        attemptNumber: 2,
      }),
    );
    expect(cancelStore.all()).toHaveLength(2);

    const storage = new AiCostLedgerStore();
    storage.recordAttempt(
      pendingVideo({ id: "s", predictionId: "pred-s", orderId: "order-s", clipId: "clip-s" }),
    );
    const billed = storage.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-s",
      providerStatus: "succeeded",
      completedAt: "2026-08-16T12:06:00.000Z",
      processingFailedAfterProviderSuccess: true,
    });
    expect(billed?.cost_usd).toBe(0.125);
  });

  it("11. full successful pack projects $0.73", () => {
    expect(PROJECTED_STANDARD_PACK_COST_USD).toBe(0.73);
    expect(projectedStandardPackCostUsd()).toBe(0.73);
    expect(SEEDANCE_FAST_MODEL).toBe("bytedance/seedance-1-pro-fast");
    expect(SEEDANCE_PRICE_PER_SECOND_USD).toBe(0.025);
    const details = buildOrderCostDetails({
      amountCents: PET_PRICE_CENTS,
      ledger: [
        ...Array.from({ length: 12 }, (_, i) => {
          const row = buildPendingLedgerRow({
            id: `img-${i}`,
            predictionId: `img-pred-${i}`,
            orderId: "pack",
            sceneKey: `scene-${i}`,
            attemptNumber: 1,
            tariff: {
              provider: "replicate",
              model: "black-forest-labs/flux-kontext-pro",
              modelVersion: null,
              pricingMethod: "per_successful_output",
              unitCostUsd: 0.04,
              currency: "usd",
              source: "ai_model_pricing",
              pricingRowId: null,
              capturedAt: "2026-08-16T00:00:00.000Z",
              mediaType: "image",
            },
            startedAt: "2026-08-16T12:00:00.000Z",
          });
          return { ...row, cost_usd: 0.04, cost_state: "exact" as const, provider_status: "succeeded", billable_units: 1, completed_at: "now" };
        }),
        {
          ...pendingVideo({ id: "v1", predictionId: "v1", orderId: "pack", clipId: "c1" }),
          cost_usd: 0.125,
          cost_state: "exact" as const,
          provider_status: "succeeded",
          billable_units: 5,
          completed_at: "now",
        },
        {
          ...pendingVideo({ id: "v2", predictionId: "v2", orderId: "pack", clipId: "c2" }),
          cost_usd: 0.125,
          cost_state: "exact" as const,
          provider_status: "succeeded",
          billable_units: 5,
          completed_at: "now",
        },
      ],
    });
    expect(details.imageAiUsd).toBe(0.48);
    expect(details.videoAiUsd).toBe(0.25);
    expect(details.replicateUsd).toBe(0.73);
    expect(details.revenueUsd).toBe(59);
    expect(details.grossAfterAiUsd).toBe(58.27);
    expect(formatUsd(details.grossAfterAiUsd)).toBe("$58.27");
    expect(details.disclaimer).toBe(GROSS_AFTER_AI_DISCLAIMER);
  });

  it("16-20. delivery invariant includes both videos", () => {
    const paid = "now";
    const readyImages = Array.from({ length: 12 }, () => ({ status: "ready" }));
    const eleven = Array.from({ length: 11 }, () => ({ status: "ready" }));
    const twoReady = [
      { status: "ready", qcStatus: "approved" as const },
      { status: "ready", qcStatus: "approved" as const },
    ];
    expect(
      markCompleteCannotBypass({
        paidAt: paid,
        orderStatus: "awaiting_video_qc",
        scenes: readyImages,
        clips: [{ status: "failed" }, { status: "ready", qcStatus: "approved" }],
      }),
    ).toBe(true);
    expect(
      markCompleteCannotBypass({
        paidAt: paid,
        orderStatus: "awaiting_video_qc",
        scenes: eleven,
        clips: twoReady,
      }),
    ).toBe(true);
    expect(
      markCompleteCannotBypass({
        paidAt: paid,
        orderStatus: "awaiting_video_qc",
        scenes: readyImages,
        clips: [{ status: "ready", qcStatus: "approved" }],
      }),
    ).toBe(true);
    expect(
      markCompleteCannotBypass({
        paidAt: paid,
        orderStatus: "awaiting_video_qc",
        scenes: readyImages,
        clips: twoReady,
      }),
    ).toBe(false);
  });

  it("21-22. customer cannot access another order and signed URLs require QC", () => {
    expect(customerCannotAccessOtherOrderVideos("order-a", "order-b")).toBe(true);
    expect(
      canIssueSignedVideoUrl({
        orderStatus: "complete",
        clipStatus: "ready",
        qcStatus: "approved",
        requesterOrderId: "order-a",
        clipOrderId: "order-b",
      }),
    ).toBe(false);
    expect(
      canIssueSignedVideoUrl({
        orderStatus: "awaiting_video_qc",
        clipStatus: "succeeded",
        requesterOrderId: "order-a",
        clipOrderId: "order-a",
      }),
    ).toBe(false);
    expect(
      canIssueSignedVideoUrl({
        orderStatus: "complete",
        clipStatus: "ready",
        qcStatus: "approved",
        requesterOrderId: "order-a",
        clipOrderId: "order-a",
      }),
    ).toBe(true);
  });

  it("23-25. server-owned price, snapshots, and one-time Stripe", () => {
    expect(rejectClientPriceTampering({ amountCents: 1 }).ok).toBe(false);
    expect(rejectClientPriceTampering({ amountCents: 5900, sku: PET_PRODUCT_SKU }).ok).toBe(true);
    const offer = resolveServerOwnedOffer({
      amountCents: 8900,
      currency: "usd",
      sku: PET_PRODUCT_SKU,
      subscription: false,
      active: true,
    });
    expect(offer.ok).toBe(true);
    if (offer.ok) expect(offer.amountCents).toBe(8900);
    const kept = orderRetainsSnapshottedPrice({ amountCents: 5900, offerVersion: 1 }, { amountCents: 8900, version: 2 });
    expect(kept).toEqual({ amountCents: 5900, offerVersion: 1 });
    expect(stripeCheckoutIsOneTimePayment("payment")).toBe(true);
    expect(
      stripeFulfillmentDecision({
        eventType: "checkout.session.completed",
        sku: PET_PRODUCT_SKU,
        mode: "subscription",
        paymentStatus: "paid",
      }).fulfill,
    ).toBe(false);
    expect(resolveServerOwnedOffer(null).ok).toBe(false);
  });

  it("applies vtm99 as a server-owned 100% promo and ignores client percent", () => {
    expect(resolveServerOwnedPromo("vtm99").ok).toBe(true);
    const applied = resolveServerOwnedPromo("VTM99");
    expect(applied.ok).toBe(true);
    if (applied.ok && applied.code) {
      expect(applied.code).toBe("VTM99");
      expect(applied.discountPercent).toBe(100);
      expect(applied.chargedAmountCents).toBe(0);
    }
    expect(resolveServerOwnedPromo("vtm99", 100).ok).toBe(false);
    expect(resolveServerOwnedPromo("FREE100").ok).toBe(false);
    expect(resolveServerOwnedPromo("").ok).toBe(true);
  });

  it("uses server-controlled Seedance inputs", () => {
    expect(seedanceInput({ prompt: "subtle motion", imageUrl: "https://signed/pet.jpg", duration: 5, resolution: "720p" })).toEqual({
      prompt: "subtle motion",
      image: "https://signed/pet.jpg",
      duration: 5,
      resolution: "720p",
      camera_fixed: false,
    });
  });

  it("date filters still apply on mixed image/video spend", () => {
    const store = new AiCostLedgerStore();
    store.recordAttempt(pendingVideo({ id: "old", predictionId: "old", orderId: "o1", clipId: "c1" }));
    store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "old",
      providerStatus: "succeeded",
      completedAt: "2026-08-10T10:01:00.000Z",
    });
    store.recordAttempt(pendingVideo({ id: "new", predictionId: "new", orderId: "o2", clipId: "c2" }));
    store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "new",
      providerStatus: "succeeded",
      completedAt: "2026-08-16T10:01:00.000Z",
    });
    const period = rangeToIso("2026-08-16", "2026-08-16");
    const report = buildAdminAiCostReport({
      fromIso: period.fromIso,
      toIso: period.toIso,
      todayFromIso: period.fromIso,
      todayToIso: period.toIso,
      periodLedger: store.all(),
      todayLedger: store.all(),
      paidOrdersInPeriod: [],
      ledgerForPaidOrders: [],
      currentTariff: {
        provider: "replicate",
        model: "black-forest-labs/flux-kontext-pro",
        modelVersion: null,
        pricingMethod: "per_successful_output",
        unitCostUsd: 0.04,
        currency: "usd",
        source: "ai_model_pricing",
        pricingRowId: null,
        capturedAt: "2026-08-16T00:00:00.000Z",
      },
    });
    expect(report.cards.videoGenerationSpendUsd).toBe(0.13);
    expect(report.cards.successfulVideoClips).toBe(1);
    expect(report.cards.projectedStandardPackCostUsd).toBe(0.73);
  });
});

describe("hover gallery clips", () => {
  it("maps every scene and species to a local mp4 poster pair", async () => {
    const { PET_DEMO_CLIP_IDS, PET_SCENES, sceneClipSrc, sceneHasMotionClip, sceneImageSrc } = await import("./catalog");
    for (const species of ["dog", "cat", "other"] as const) {
      for (const scene of PET_SCENES) {
        expect(sceneImageSrc(scene.id, species)).toBe(`/pet/${species}/scenes/${scene.id}.webp`);
        expect(sceneClipSrc(scene.id, species)).toBe(`/pet/${species}/clips/${scene.id}.mp4`);
      }
    }
    expect(sceneHasMotionClip("formula-racer")).toBe(true);
    expect(sceneHasMotionClip("spa-bathtub")).toBe(true);
    expect(sceneHasMotionClip("royal-portrait")).toBe(false);
    expect(PET_DEMO_CLIP_IDS).toHaveLength(2);
  });
});
