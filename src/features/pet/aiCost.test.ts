import { describe, expect, it } from "vitest";
import { PET_PRICE_CENTS, PET_SCENE_COUNT } from "./types";
import {
  AI_COST_PROVIDER_REPLICATE,
  AI_COST_SCOPE_LABEL,
  AiCostLedgerStore,
  GROSS_AFTER_AI_DISCLAIMER,
  KONTEXT_PRO_MODEL,
  KONTEXT_PRO_UNIT_COST_USD,
  PROJECTED_STANDARD_PACK_COST_USD,
  applyIdempotentLedgerWrite,
  buildAdminAiCostReport,
  buildOrderCostDetails,
  buildPendingLedgerRow,
  canReadAiCostLedger,
  canWriteAiCostLedger,
  createFailedPredictionId,
  finalizeLedgerRow,
  formatUsd,
  mockPredictionId,
  projectedStandardPackCostUsd,
  rangeToIso,
  rejectClientCostTampering,
  snapshotKontextProTariff,
  sumTrackedCostUsd,
} from "./aiCost";

function pending(input: {
  id: string;
  predictionId: string;
  orderId: string;
  sceneKey: string;
  attemptNumber?: number;
  startedAt?: string;
  tariff?: ReturnType<typeof snapshotKontextProTariff>;
  isMock?: boolean;
  createFailed?: boolean;
}) {
  return buildPendingLedgerRow({
    id: input.id,
    predictionId: input.predictionId,
    orderId: input.orderId,
    sceneKey: input.sceneKey,
    attemptNumber: input.attemptNumber ?? 1,
    tariff: input.tariff ?? snapshotKontextProTariff({ capturedAt: "2026-08-16T00:00:00.000Z" }),
    startedAt: input.startedAt ?? "2026-08-16T12:00:00.000Z",
    isMock: input.isMock,
    createFailed: input.createFailed,
  });
}

describe("Replicate cost accounting", () => {
  it("does not duplicate cost when the same webhook is delivered twice", () => {
    const store = new AiCostLedgerStore();
    const row = pending({
      id: "row-1",
      predictionId: "pred-dup",
      orderId: "order-1",
      sceneKey: "royal-portrait",
    });
    store.recordAttempt(row);
    store.recordAttempt(row);
    store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-dup",
      providerStatus: "succeeded",
      completedAt: "2026-08-16T12:01:00.000Z",
    });
    const second = store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-dup",
      providerStatus: "succeeded",
      completedAt: "2026-08-16T12:02:00.000Z",
    });
    expect(store.all()).toHaveLength(1);
    expect(second?.cost_usd).toBe(0.04);
    expect(second?.cost_state).toBe("exact");
    expect(sumTrackedCostUsd(store.all())).toBe(0.04);
  });

  it("charges exactly $0.48 for 12 first-attempt Kontext Pro successes", () => {
    const store = new AiCostLedgerStore();
    const orderId = "order-pack";
    for (let i = 0; i < PET_SCENE_COUNT; i += 1) {
      const predictionId = `pred-${i}`;
      store.recordAttempt(
        pending({
          id: `row-${i}`,
          predictionId,
          orderId,
          sceneKey: `scene-${i}`,
        }),
      );
      store.finalize({
        provider: AI_COST_PROVIDER_REPLICATE,
        predictionId,
        providerStatus: "succeeded",
        completedAt: "2026-08-16T12:05:00.000Z",
      });
    }
    expect(sumTrackedCostUsd(store.all())).toBe(0.48);
    expect(formatUsd(sumTrackedCostUsd(store.all()))).toBe("$0.48");
    const details = buildOrderCostDetails({
      amountCents: PET_PRICE_CENTS,
      ledger: store.all(),
    });
    expect(details.revenueUsd).toBe(59);
    expect(formatUsd(details.revenueUsd)).toBe("$59.00");
    expect(details.replicateUsd).toBe(0.48);
    expect(details.grossAfterAiUsd).toBe(58.52);
    expect(formatUsd(details.grossAfterAiUsd)).toBe("$58.52");
    expect(details.disclaimer).toBe(GROSS_AFTER_AI_DISCLAIMER);
  });

  it("records a failed prediction as exact $0", () => {
    const store = new AiCostLedgerStore();
    store.recordAttempt(
      pending({
        id: "fail-row",
        predictionId: "pred-fail",
        orderId: "order-fail",
        sceneKey: "astronaut",
      }),
    );
    const row = store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-fail",
      providerStatus: "failed",
      completedAt: "2026-08-16T12:06:00.000Z",
    });
    expect(row?.cost_usd).toBe(0);
    expect(row?.cost_state).toBe("exact");
    expect(row?.billable_units).toBe(0);
    expect(sumTrackedCostUsd(store.all())).toBe(0);
  });

  it("records a canceled official prediction as conservative estimated $0.04", () => {
    const store = new AiCostLedgerStore();
    store.recordAttempt(
      pending({
        id: "cancel-row",
        predictionId: "pred-cancel",
        orderId: "order-cancel",
        sceneKey: "head-chef",
      }),
    );
    const row = store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-cancel",
      providerStatus: "canceled",
      completedAt: "2026-08-16T12:07:00.000Z",
    });
    expect(row?.cost_usd).toBe(0.04);
    expect(row?.cost_state).toBe("estimated");
    expect(row?.provider_status).toBe("canceled");
  });

  it("adds retry and regeneration predictions instead of overwriting older attempts", () => {
    const store = new AiCostLedgerStore();
    store.recordAttempt(
      pending({
        id: "orig",
        predictionId: "pred-original",
        orderId: "order-retry",
        sceneKey: "newspaper",
        attemptNumber: 1,
      }),
    );
    store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-original",
      providerStatus: "failed",
      completedAt: "2026-08-16T12:08:00.000Z",
    });
    store.recordAttempt(
      pending({
        id: "retry",
        predictionId: "pred-retry",
        orderId: "order-retry",
        sceneKey: "newspaper",
        attemptNumber: 2,
      }),
    );
    store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-retry",
      providerStatus: "succeeded",
      completedAt: "2026-08-16T12:09:00.000Z",
    });
    expect(store.all()).toHaveLength(2);
    expect(store.get(AI_COST_PROVIDER_REPLICATE, "pred-original")?.cost_usd).toBe(0);
    expect(store.get(AI_COST_PROVIDER_REPLICATE, "pred-retry")?.is_retry).toBe(true);
    expect(sumTrackedCostUsd(store.all())).toBe(0.04);
    store.recordAttempt(
      pending({
        id: "regen",
        predictionId: "pred-regen",
        orderId: "order-retry",
        sceneKey: "newspaper",
        attemptNumber: 3,
      }),
    );
    store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-regen",
      providerStatus: "succeeded",
      completedAt: "2026-08-16T12:10:00.000Z",
    });
    expect(store.all()).toHaveLength(3);
    expect(sumTrackedCostUsd(store.all())).toBe(0.08);
  });

  it("records mock generations as $0 and marks them mock", () => {
    const store = new AiCostLedgerStore();
    const orderId = "order-mock";
    for (let i = 0; i < PET_SCENE_COUNT; i += 1) {
      store.recordAttempt(
        pending({
          id: `mock-${i}`,
          predictionId: mockPredictionId(orderId, `scene-${i}`, 1),
          orderId,
          sceneKey: `scene-${i}`,
          isMock: true,
        }),
      );
    }
    expect(store.all().every((row) => row.is_mock && row.cost_usd === 0 && row.cost_state === "exact")).toBe(
      true,
    );
    expect(store.all().every((row) => row.cost_notes === "mock_generation")).toBe(true);
    expect(sumTrackedCostUsd(store.all())).toBe(0);
  });

  it("keeps historical tariff snapshots when model pricing later changes", () => {
    const oldTariff = snapshotKontextProTariff({
      capturedAt: "2026-08-01T00:00:00.000Z",
      unitCostUsd: 0.04,
    });
    const newTariff = snapshotKontextProTariff({
      capturedAt: "2026-08-16T00:00:00.000Z",
      unitCostUsd: 0.1,
    });
    const historical = pending({
      id: "hist",
      predictionId: "pred-hist",
      orderId: "order-hist",
      sceneKey: "cinema-boss",
      tariff: oldTariff,
    });
    const finalized = finalizeLedgerRow(historical, "succeeded", "2026-08-16T12:11:00.000Z");
    const afterPriceChange = applyIdempotentLedgerWrite(
      finalized,
      pending({
        id: "hist-new",
        predictionId: "pred-hist",
        orderId: "order-hist",
        sceneKey: "cinema-boss",
        tariff: newTariff,
      }),
    );
    expect(finalized.cost_usd).toBe(0.04);
    expect(afterPriceChange.cost_usd).toBe(0.04);
    expect(afterPriceChange.tariff_snapshot.unitCostUsd).toBe(0.04);
    const newer = finalizeLedgerRow(
      pending({
        id: "new",
        predictionId: "pred-new-price",
        orderId: "order-hist",
        sceneKey: "cinema-boss",
        tariff: newTariff,
      }),
      "succeeded",
      "2026-08-16T12:12:00.000Z",
    );
    expect(newer.cost_usd).toBe(0.1);
  });

  it("denies ledger reads to anon and regular users and writes to anyone except service role", () => {
    expect(canReadAiCostLedger({ isAdmin: false, isAnon: true })).toBe(false);
    expect(canReadAiCostLedger({ isAdmin: false, isAuthenticated: true })).toBe(false);
    expect(canReadAiCostLedger({ isAdmin: true })).toBe(true);
    expect(canReadAiCostLedger({ isAdmin: false, isServiceRole: true })).toBe(true);
    expect(canWriteAiCostLedger({ isServiceRole: false, isAdmin: true })).toBe(false);
    expect(canWriteAiCostLedger({ isServiceRole: true })).toBe(true);
  });

  it("applies date filters and isolates per-order totals", () => {
    const store = new AiCostLedgerStore();
    store.recordAttempt(
      pending({
        id: "a",
        predictionId: "pred-a",
        orderId: "order-a",
        sceneKey: "royal-portrait",
        startedAt: "2026-08-10T10:00:00.000Z",
      }),
    );
    store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-a",
      providerStatus: "succeeded",
      completedAt: "2026-08-10T10:01:00.000Z",
    });
    store.recordAttempt(
      pending({
        id: "b",
        predictionId: "pred-b",
        orderId: "order-b",
        sceneKey: "royal-portrait",
        startedAt: "2026-08-16T10:00:00.000Z",
      }),
    );
    store.finalize({
      provider: AI_COST_PROVIDER_REPLICATE,
      predictionId: "pred-b",
      providerStatus: "succeeded",
      completedAt: "2026-08-16T10:01:00.000Z",
    });
    const { fromIso, toIso } = rangeToIso("2026-08-16", "2026-08-16");
    const today = rangeToIso("2026-08-16", "2026-08-16");
    const paidOrders = [
      {
        id: "order-b",
        amount_cents: PET_PRICE_CENTS,
        currency: "usd",
        paid_at: "2026-08-16T09:00:00.000Z",
        status: "complete",
        pet_name: "Luna",
        email: "owner@example.com",
      },
    ];
    const report = buildAdminAiCostReport({
      fromIso,
      toIso,
      todayFromIso: today.fromIso,
      todayToIso: today.toIso,
      periodLedger: store.all(),
      todayLedger: store.all(),
      paidOrdersInPeriod: paidOrders,
      ledgerForPaidOrders: store.all().filter((row) => row.pet_order_id === "order-b"),
      currentTariff: snapshotKontextProTariff(),
    });
    expect(report.scope).toBe(AI_COST_SCOPE_LABEL);
    expect(report.cards.replicateCostPeriodUsd).toBe(0.04);
    expect(report.cards.replicateCostTodayUsd).toBe(0.04);
    expect(report.cards.petRevenuePeriodUsd).toBe(59);
    expect(report.cards.grossAfterAiUsd).toBe(58.96);
    expect(report.cards.avgAiCostPerPaidPetOrderUsd).toBe(0.04);
    expect(report.cards.avgCostPerSuccessfulPortraitUsd).toBe(0.04);
    expect(report.cards.projectedStandardPackCostUsd).toBe(0.73);
    expect(report.breakdown.byOrder).toEqual([
      {
        orderId: "order-b",
        petName: "Luna",
        email: "owner@example.com",
        costUsd: 0.04,
        revenueUsd: 59,
        grossAfterAiUsd: 58.96,
      },
    ]);
    expect(report.breakdown.byDate.map((row) => row.date)).toEqual(["2026-08-16"]);
  });

  it("keeps a provider success billable after a later storage or processing failure", () => {
    const row = finalizeLedgerRow(
      pending({
        id: "storage",
        predictionId: "pred-storage",
        orderId: "order-storage",
        sceneKey: "beach-vacation",
      }),
      "succeeded",
      "2026-08-16T12:13:00.000Z",
      true,
    );
    expect(row.cost_usd).toBe(0.04);
    expect(row.cost_state).toBe("exact");
  });

  it("records prediction-create failures without a Replicate id as $0", () => {
    const row = pending({
      id: "create-fail",
      predictionId: createFailedPredictionId("nonce-1"),
      orderId: "order-create-fail",
      sceneKey: "spa-bathtub",
      createFailed: true,
    });
    expect(row.prediction_id.startsWith("create-failed:")).toBe(true);
    expect(row.cost_usd).toBe(0);
    expect(row.cost_state).toBe("exact");
    expect(row.cost_notes).toBe("create_failed_no_prediction_id");
    expect(sumTrackedCostUsd([row])).toBe(0);
  });

  it("projects a standard 12-portrait + 2-clip pack at $0.73", () => {
    expect(PROJECTED_STANDARD_PACK_COST_USD).toBe(0.73);
    expect(projectedStandardPackCostUsd()).toBe(0.73);
    expect(formatUsd(KONTEXT_PRO_UNIT_COST_USD)).toBe("$0.04");
    expect(KONTEXT_PRO_MODEL).toBe("black-forest-labs/flux-kontext-pro");
  });

  it("rejects cost values supplied by the browser", () => {
    expect(rejectClientCostTampering({ action: "costSummary", from: "2026-08-01" }).ok).toBe(true);
    expect(rejectClientCostTampering({ action: "list", cost_usd: 0.04 }).ok).toBe(false);
    expect(rejectClientCostTampering({ action: "get", costUsd: 12 }).ok).toBe(false);
    expect(rejectClientCostTampering({ action: "orderCosts", cost_state: "exact" }).ok).toBe(false);
  });

  it("does not invent historical cost when the ledger is empty", () => {
    const { fromIso, toIso } = rangeToIso("2026-08-01", "2026-08-16");
    const report = buildAdminAiCostReport({
      fromIso,
      toIso,
      todayFromIso: fromIso,
      todayToIso: toIso,
      periodLedger: [],
      todayLedger: [],
      paidOrdersInPeriod: [],
      ledgerForPaidOrders: [],
      currentTariff: snapshotKontextProTariff(),
    });
    expect(report.cards.replicateCostPeriodUsd).toBe(0);
    expect(report.cards.replicateCostTodayUsd).toBe(0);
    expect(report.cards.petRevenuePeriodUsd).toBe(0);
    expect(report.cards.grossAfterAiUsd).toBe(0);
    expect(report.cards.avgAiCostPerPaidPetOrderUsd).toBe(0);
    expect(report.cards.avgCostPerSuccessfulPortraitUsd).toBe(0);
    expect(report.cards.retryRegenerationCostUsd).toBe(0);
    expect(report.breakdown.byDate).toEqual([]);
    expect(report.breakdown.byOrder).toEqual([]);
    expect(sumTrackedCostUsd([])).toBe(0);
  });
});
