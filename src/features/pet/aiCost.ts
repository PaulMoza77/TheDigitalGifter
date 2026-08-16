import { PET_PRICE_CENTS, PET_PRODUCT_SKU, PET_SCENE_COUNT } from "./types";

export const AI_COST_PROVIDER_REPLICATE = "replicate" as const;
export const AI_COST_PRODUCT_FAMILY = "pet_funnel" as const;
export const KONTEXT_PRO_MODEL = "black-forest-labs/flux-kontext-pro";
export const KONTEXT_PRO_PRICING_METHOD = "per_successful_output" as const;
export const KONTEXT_PRO_UNIT_COST_USD = 0.04;
export const KONTEXT_PRO_PRICING_SOURCE = "ai_model_pricing";
export const PROJECTED_STANDARD_PACK_COST_USD = roundUsd(KONTEXT_PRO_UNIT_COST_USD * PET_SCENE_COUNT);
export const REPLICATE_BILLING_URL = "https://replicate.com/account/billing";
export const AI_COST_SCOPE_LABEL = "Tracked pet-funnel Replicate usage";
export const AI_COST_TOOLTIP =
  "Recorded application usage based on the tariff snapshot for each prediction. Account balance and invoice reconciliation remain in Replicate.";
export const GROSS_AFTER_AI_DISCLAIMER =
  "Before Stripe fees, advertising, and other operating costs.";
export const FINALIZED_COST_STATES = ["exact", "estimated", "reconciled"] as const;
export const LEDGER_COST_STATES = ["pending", "exact", "estimated", "reconciled"] as const;

export type CostState = (typeof LEDGER_COST_STATES)[number];
export type ProviderStatus =
  | "starting"
  | "succeeded"
  | "failed"
  | "canceled"
  | "create_failed"
  | "mock";

export type TariffSnapshot = {
  provider: typeof AI_COST_PROVIDER_REPLICATE;
  model: string;
  modelVersion: string | null;
  pricingMethod: string;
  unitCostUsd: number;
  currency: "usd";
  source: string;
  pricingRowId: string | null;
  capturedAt: string;
  notes?: string;
};

export type AiCostLedgerRow = {
  id: string;
  provider: string;
  prediction_id: string;
  product_family: string;
  pet_order_id: string | null;
  scene_id: string | null;
  scene_key: string | null;
  attempt_number: number;
  is_retry: boolean;
  is_mock: boolean;
  product_sku: string | null;
  model_name: string;
  model_version: string | null;
  provider_status: string;
  pricing_method: string;
  unit_cost_usd: number;
  billable_units: number;
  cost_usd: number;
  cost_state: CostState;
  pricing_source: string;
  tariff_snapshot: TariffSnapshot;
  currency: "usd";
  started_at: string;
  completed_at: string | null;
  cost_notes: string | null;
};

export type PaidPetOrder = {
  id: string;
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  status: string;
  pet_name?: string | null;
  email?: string | null;
};

export function roundUsd(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function moneyUsd(value: number): number {
  return roundUsd(toUsd(value), 2);
}

export function toUsd(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(moneyUsd(value));
}

export function rangeToIso(from: string, to: string): { fromIso: string; toIso: string } {
  return {
    fromIso: `${from}T00:00:00.000Z`,
    toIso: `${to}T23:59:59.999Z`,
  };
}

export function utcDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function snapshotKontextProTariff(input?: {
  capturedAt?: string;
  modelVersion?: string | null;
  pricingRowId?: string | null;
  unitCostUsd?: number;
  source?: string;
}): TariffSnapshot {
  return {
    provider: AI_COST_PROVIDER_REPLICATE,
    model: KONTEXT_PRO_MODEL,
    modelVersion: input?.modelVersion ?? null,
    pricingMethod: KONTEXT_PRO_PRICING_METHOD,
    unitCostUsd: roundUsd(input?.unitCostUsd ?? KONTEXT_PRO_UNIT_COST_USD),
    currency: "usd",
    source: input?.source ?? KONTEXT_PRO_PRICING_SOURCE,
    pricingRowId: input?.pricingRowId ?? null,
    capturedAt: input?.capturedAt ?? "1970-01-01T00:00:00.000Z",
    notes: "Kontext Pro per successful output",
  };
}

export function mockPredictionId(orderId: string, sceneKey: string, attempt: number): string {
  return `mock:${orderId}:${sceneKey}:${attempt}`;
}

export function createFailedPredictionId(nonce: string): string {
  return `create-failed:${nonce}`;
}

export function isFinalizedCostState(state: string): boolean {
  return (FINALIZED_COST_STATES as readonly string[]).includes(state);
}

export function canReadAiCostLedger(input: {
  isAdmin: boolean;
  isServiceRole?: boolean;
  isAnon?: boolean;
  isAuthenticated?: boolean;
}): boolean {
  if (input.isAnon) return false;
  if (input.isServiceRole) return true;
  if (input.isAdmin) return true;
  return false;
}

export function canWriteAiCostLedger(input: { isServiceRole: boolean; isAdmin?: boolean }): boolean {
  return input.isServiceRole === true;
}

export const CLIENT_OWNED_COST_KEYS = [
  "cost_usd",
  "costUsd",
  "unit_cost_usd",
  "unitCostUsd",
  "billable_units",
  "billableUnits",
  "cost_state",
  "costState",
  "tariff_snapshot",
  "tariffSnapshot",
] as const;

export function rejectClientCostTampering(
  body: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const blocked = CLIENT_OWNED_COST_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(body, key));
  if (blocked.length) {
    return { ok: false, message: "Cost values are server-owned and cannot be supplied by the client." };
  }
  return { ok: true };
}

export function computeFinalCost(input: {
  providerStatus: string;
  isMock?: boolean;
  createFailed?: boolean;
  tariff: TariffSnapshot;
}): { cost_usd: number; billable_units: number; cost_state: CostState; provider_status: string } {
  if (input.isMock) {
    return { cost_usd: 0, billable_units: 0, cost_state: "exact", provider_status: "mock" };
  }
  if (input.createFailed || input.providerStatus === "create_failed") {
    return {
      cost_usd: 0,
      billable_units: 0,
      cost_state: "exact",
      provider_status: "create_failed",
    };
  }
  const unit = roundUsd(input.tariff.unitCostUsd);
  const method = input.tariff.pricingMethod;
  if (input.providerStatus === "succeeded") {
    const billable = method === KONTEXT_PRO_PRICING_METHOD ? 1 : 0;
    return {
      cost_usd: roundUsd(unit * billable),
      billable_units: billable,
      cost_state: "exact",
      provider_status: "succeeded",
    };
  }
  if (input.providerStatus === "failed") {
    return { cost_usd: 0, billable_units: 0, cost_state: "exact", provider_status: "failed" };
  }
  if (input.providerStatus === "canceled") {
    return {
      cost_usd: unit,
      billable_units: method === KONTEXT_PRO_PRICING_METHOD ? 1 : 0,
      cost_state: "estimated",
      provider_status: "canceled",
    };
  }
  return {
    cost_usd: 0,
    billable_units: 0,
    cost_state: "pending",
    provider_status: input.providerStatus || "starting",
  };
}

export function buildPendingLedgerRow(input: {
  id: string;
  predictionId: string;
  orderId: string;
  sceneId?: string | null;
  sceneKey: string;
  attemptNumber: number;
  modelName?: string;
  modelVersion?: string | null;
  tariff: TariffSnapshot;
  startedAt: string;
  isMock?: boolean;
  createFailed?: boolean;
  sku?: string;
}): AiCostLedgerRow {
  const attemptNumber = Math.max(1, Number(input.attemptNumber) || 1);
  const computed = computeFinalCost({
    providerStatus: input.isMock ? "mock" : input.createFailed ? "create_failed" : "starting",
    isMock: input.isMock,
    createFailed: input.createFailed,
    tariff: input.tariff,
  });
  const pending = !input.isMock && !input.createFailed;
  return {
    id: input.id,
    provider: AI_COST_PROVIDER_REPLICATE,
    prediction_id: input.predictionId,
    product_family: AI_COST_PRODUCT_FAMILY,
    pet_order_id: input.orderId,
    scene_id: input.sceneId ?? null,
    scene_key: input.sceneKey,
    attempt_number: attemptNumber,
    is_retry: attemptNumber > 1,
    is_mock: Boolean(input.isMock),
    product_sku: input.sku ?? PET_PRODUCT_SKU,
    model_name: input.modelName ?? input.tariff.model,
    model_version: input.modelVersion ?? input.tariff.modelVersion,
    provider_status: computed.provider_status,
    pricing_method: input.tariff.pricingMethod,
    unit_cost_usd: roundUsd(input.tariff.unitCostUsd),
    billable_units: pending ? 0 : computed.billable_units,
    cost_usd: pending ? 0 : computed.cost_usd,
    cost_state: pending ? "pending" : computed.cost_state,
    pricing_source: input.tariff.source,
    tariff_snapshot: input.tariff,
    currency: "usd",
    started_at: input.startedAt,
    completed_at: pending ? null : input.startedAt,
    cost_notes: input.isMock
      ? "mock_generation"
      : input.createFailed
        ? "create_failed_no_prediction_id"
        : null,
  };
}

export function applyIdempotentLedgerWrite(
  existing: AiCostLedgerRow | null,
  incoming: AiCostLedgerRow,
): AiCostLedgerRow {
  if (!existing) return incoming;
  if (isFinalizedCostState(existing.cost_state)) {
    return existing;
  }
  if (incoming.cost_state === "pending") {
    return existing;
  }
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    provider: existing.provider,
    prediction_id: existing.prediction_id,
    tariff_snapshot: existing.tariff_snapshot,
    unit_cost_usd: existing.unit_cost_usd,
    pricing_method: existing.pricing_method,
    pricing_source: existing.pricing_source,
    started_at: existing.started_at,
    is_mock: existing.is_mock,
    is_retry: existing.is_retry,
    attempt_number: existing.attempt_number,
    product_sku: existing.product_sku,
    pet_order_id: existing.pet_order_id,
    scene_id: existing.scene_id ?? incoming.scene_id,
    scene_key: existing.scene_key ?? incoming.scene_key,
  };
}

export function finalizeLedgerRow(
  existing: AiCostLedgerRow,
  providerStatus: string,
  completedAt: string,
  processingFailedAfterProviderSuccess = false,
): AiCostLedgerRow {
  if (isFinalizedCostState(existing.cost_state)) return existing;
  const computed = computeFinalCost({
    providerStatus,
    isMock: existing.is_mock,
    tariff: existing.tariff_snapshot,
  });
  void processingFailedAfterProviderSuccess;
  return {
    ...existing,
    provider_status: computed.provider_status,
    billable_units: computed.billable_units,
    cost_usd: computed.cost_usd,
    cost_state: computed.cost_state,
    completed_at: completedAt,
  };
}

export class AiCostLedgerStore {
  private readonly rows = new Map<string, AiCostLedgerRow>();

  static key(provider: string, predictionId: string): string {
    return `${provider}::${predictionId}`;
  }

  get(provider: string, predictionId: string): AiCostLedgerRow | undefined {
    return this.rows.get(AiCostLedgerStore.key(provider, predictionId));
  }

  all(): AiCostLedgerRow[] {
    return [...this.rows.values()];
  }

  recordAttempt(row: AiCostLedgerRow): AiCostLedgerRow {
    const key = AiCostLedgerStore.key(row.provider, row.prediction_id);
    const next = applyIdempotentLedgerWrite(this.rows.get(key) ?? null, row);
    this.rows.set(key, next);
    return next;
  }

  finalize(input: {
    provider: string;
    predictionId: string;
    providerStatus: string;
    completedAt: string;
    processingFailedAfterProviderSuccess?: boolean;
  }): AiCostLedgerRow | null {
    const existing = this.get(input.provider, input.predictionId);
    if (!existing) return null;
    const next = finalizeLedgerRow(
      existing,
      input.providerStatus,
      input.completedAt,
      input.processingFailedAfterProviderSuccess,
    );
    this.rows.set(AiCostLedgerStore.key(existing.provider, existing.prediction_id), next);
    return next;
  }
}

export function isTrackedBillableRow(row: AiCostLedgerRow): boolean {
  return (
    row.provider === AI_COST_PROVIDER_REPLICATE &&
    row.product_family === AI_COST_PRODUCT_FAMILY &&
    !row.is_mock &&
    isFinalizedCostState(row.cost_state)
  );
}

export function occurredAt(row: AiCostLedgerRow): string {
  return row.completed_at || row.started_at;
}

export function inInclusiveRange(iso: string, fromIso: string, toIso: string): boolean {
  return iso >= fromIso && iso <= toIso;
}

export function sumTrackedCostUsd(rows: AiCostLedgerRow[]): number {
  return roundUsd(
    rows.filter(isTrackedBillableRow).reduce((sum, row) => sum + toUsd(row.cost_usd), 0),
  );
}

export function projectedStandardPackCostUsd(tariff = snapshotKontextProTariff()): number {
  return moneyUsd(toUsd(tariff.unitCostUsd) * PET_SCENE_COUNT);
}

export type AdminAiCostReport = {
  scope: typeof AI_COST_SCOPE_LABEL;
  currency: "usd";
  billingUrl: typeof REPLICATE_BILLING_URL;
  tooltip: typeof AI_COST_TOOLTIP;
  disclaimer: typeof GROSS_AFTER_AI_DISCLAIMER;
  cards: {
    replicateCostPeriodUsd: number;
    replicateCostTodayUsd: number;
    petRevenuePeriodUsd: number;
    grossAfterAiUsd: number;
    avgAiCostPerPaidPetOrderUsd: number;
    avgCostPerSuccessfulPortraitUsd: number;
    retryRegenerationCostUsd: number;
    projectedStandardPackCostUsd: number;
  };
  breakdown: {
    byDate: Array<{ date: string; costUsd: number; count: number }>;
    byModel: Array<{ model: string; costUsd: number; count: number }>;
    byStatus: Array<{ status: string; costUsd: number; count: number }>;
    byAttemptKind: Array<{ kind: "original" | "retry"; costUsd: number; count: number }>;
    byOrder: Array<{
      orderId: string;
      petName: string;
      email: string;
      costUsd: number;
      revenueUsd: number;
      grossAfterAiUsd: number;
    }>;
  };
  currentTariff: TariffSnapshot;
};

function groupSum(
  rows: AiCostLedgerRow[],
  keyOf: (row: AiCostLedgerRow) => string,
): Array<{ key: string; costUsd: number; count: number }> {
  const map = new Map<string, { costUsd: number; count: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const current = map.get(key) || { costUsd: 0, count: 0 };
    current.count += 1;
    current.costUsd = roundUsd(current.costUsd + toUsd(row.cost_usd));
    map.set(key, current);
  }
  return [...map.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.costUsd - a.costUsd || a.key.localeCompare(b.key));
}

export function buildAdminAiCostReport(input: {
  fromIso: string;
  toIso: string;
  todayFromIso: string;
  todayToIso: string;
  periodLedger: AiCostLedgerRow[];
  todayLedger: AiCostLedgerRow[];
  paidOrdersInPeriod: PaidPetOrder[];
  ledgerForPaidOrders: AiCostLedgerRow[];
  currentTariff: TariffSnapshot;
}): AdminAiCostReport {
  const period = input.periodLedger.filter(
    (row) => isTrackedBillableRow(row) && inInclusiveRange(occurredAt(row), input.fromIso, input.toIso),
  );
  const today = input.todayLedger.filter(
    (row) =>
      isTrackedBillableRow(row) && inInclusiveRange(occurredAt(row), input.todayFromIso, input.todayToIso),
  );
  const replicateCostPeriodUsd = moneyUsd(sumTrackedCostUsd(period));
  const replicateCostTodayUsd = moneyUsd(sumTrackedCostUsd(today));
  const paidOrders = input.paidOrdersInPeriod.filter(
    (order) => order.paid_at && order.status !== "refunded" && order.currency.toLowerCase() === "usd",
  );
  const petRevenuePeriodUsd = moneyUsd(
    paidOrders.reduce((sum, order) => sum + toUsd(order.amount_cents) / 100, 0),
  );
  const costByPaidOrder = new Map<string, number>();
  for (const row of input.ledgerForPaidOrders.filter(isTrackedBillableRow)) {
    if (!row.pet_order_id) continue;
    costByPaidOrder.set(
      row.pet_order_id,
      roundUsd((costByPaidOrder.get(row.pet_order_id) || 0) + toUsd(row.cost_usd)),
    );
  }
  const paidOrderCount = paidOrders.length;
  const aiCostAcrossPaidOrders = roundUsd(
    paidOrders.reduce((sum, order) => sum + (costByPaidOrder.get(order.id) || 0), 0),
  );
  const succeededPortraits = period.filter((row) => row.provider_status === "succeeded");
  const retryRows = period.filter((row) => row.is_retry);
  const byOrder = paidOrders
    .map((order) => {
      const costUsd = moneyUsd(costByPaidOrder.get(order.id) || 0);
      const revenueUsd = moneyUsd(toUsd(order.amount_cents) / 100);
      return {
        orderId: order.id,
        petName: order.pet_name || "",
        email: order.email || "",
        costUsd,
        revenueUsd,
        grossAfterAiUsd: moneyUsd(revenueUsd - costUsd),
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);

  return {
    scope: AI_COST_SCOPE_LABEL,
    currency: "usd",
    billingUrl: REPLICATE_BILLING_URL,
    tooltip: AI_COST_TOOLTIP,
    disclaimer: GROSS_AFTER_AI_DISCLAIMER,
    cards: {
      replicateCostPeriodUsd,
      replicateCostTodayUsd,
      petRevenuePeriodUsd,
      grossAfterAiUsd: moneyUsd(petRevenuePeriodUsd - replicateCostPeriodUsd),
      avgAiCostPerPaidPetOrderUsd: paidOrderCount ? moneyUsd(aiCostAcrossPaidOrders / paidOrderCount) : 0,
      avgCostPerSuccessfulPortraitUsd: succeededPortraits.length
        ? moneyUsd(sumTrackedCostUsd(succeededPortraits) / succeededPortraits.length)
        : 0,
      retryRegenerationCostUsd: moneyUsd(sumTrackedCostUsd(retryRows)),
      projectedStandardPackCostUsd: projectedStandardPackCostUsd(input.currentTariff),
    },
    breakdown: {
      byDate: groupSum(period, (row) => utcDateKey(occurredAt(row))).map((row) => ({
        date: row.key,
        costUsd: moneyUsd(row.costUsd),
        count: row.count,
      })),
      byModel: groupSum(period, (row) => row.model_name || "unknown").map((row) => ({
        model: row.key,
        costUsd: moneyUsd(row.costUsd),
        count: row.count,
      })),
      byStatus: groupSum(period, (row) => row.provider_status).map((row) => ({
        status: row.key,
        costUsd: moneyUsd(row.costUsd),
        count: row.count,
      })),
      byAttemptKind: ["original", "retry"].map((kind) => {
        const rows = period.filter((row) => (kind === "retry" ? row.is_retry : !row.is_retry));
        return {
          kind: kind as "original" | "retry",
          costUsd: moneyUsd(sumTrackedCostUsd(rows)),
          count: rows.length,
        };
      }),
      byOrder,
    },
    currentTariff: input.currentTariff,
  };
}

export type OrderSceneCost = {
  sceneKey: string;
  sceneId: string | null;
  totalUsd: number;
  attempts: Array<{
    predictionId: string;
    attemptNumber: number;
    isRetry: boolean;
    isMock: boolean;
    providerStatus: string;
    modelName: string;
    modelVersion: string | null;
    tariffUnitCostUsd: number;
    pricingMethod: string;
    costUsd: number;
    costState: CostState;
  }>;
};

export type OrderCostDetails = {
  revenueUsd: number;
  replicateUsd: number;
  grossAfterAiUsd: number;
  currency: "usd";
  disclaimer: typeof GROSS_AFTER_AI_DISCLAIMER;
  byScene: OrderSceneCost[];
  attempts: OrderSceneCost["attempts"];
};

export function buildOrderCostDetails(input: {
  amountCents?: number;
  scenes?: Array<{ id?: string; scene_key?: string; sceneKey?: string }>;
  ledger: AiCostLedgerRow[];
}): OrderCostDetails {
  const revenueUsd = moneyUsd(toUsd(input.amountCents ?? PET_PRICE_CENTS) / 100);
  const replicateUsd = moneyUsd(sumTrackedCostUsd(input.ledger));
  const attempts = [...input.ledger]
    .sort((a, b) => a.attempt_number - b.attempt_number || a.started_at.localeCompare(b.started_at))
    .map((row) => ({
      predictionId: row.prediction_id,
      attemptNumber: row.attempt_number,
      isRetry: row.is_retry,
      isMock: row.is_mock,
      providerStatus: row.provider_status,
      modelName: row.model_name,
      modelVersion: row.model_version,
      tariffUnitCostUsd: toUsd(row.tariff_snapshot?.unitCostUsd ?? row.unit_cost_usd),
      pricingMethod: row.pricing_method,
      costUsd: moneyUsd(toUsd(row.cost_usd)),
      costState: row.cost_state,
    }));
  const sceneKeys = [
    ...new Set([
      ...(input.scenes || []).map((scene) => scene.scene_key || scene.sceneKey || "").filter(Boolean),
      ...input.ledger.map((row) => row.scene_key || "").filter(Boolean),
    ]),
  ];
  const byScene = sceneKeys.map((sceneKey) => {
    const rows = input.ledger.filter((row) => row.scene_key === sceneKey);
    const scene = (input.scenes || []).find((item) => (item.scene_key || item.sceneKey) === sceneKey);
    return {
      sceneKey,
      sceneId: scene?.id || rows[0]?.scene_id || null,
      totalUsd: moneyUsd(sumTrackedCostUsd(rows)),
      attempts: attempts.filter((attempt) =>
        rows.some((row) => row.prediction_id === attempt.predictionId),
      ),
    };
  });
  return {
    revenueUsd,
    replicateUsd,
    grossAfterAiUsd: moneyUsd(revenueUsd - replicateUsd),
    currency: "usd",
    disclaimer: GROSS_AFTER_AI_DISCLAIMER,
    byScene,
    attempts,
  };
}

export function mapDbLedgerRow(row: Record<string, unknown>): AiCostLedgerRow {
  const snapshot = (row.tariff_snapshot || {}) as Partial<TariffSnapshot>;
  return {
    id: String(row.id || ""),
    provider: String(row.provider || AI_COST_PROVIDER_REPLICATE),
    prediction_id: String(row.prediction_id || ""),
    product_family: String(row.product_family || AI_COST_PRODUCT_FAMILY),
    pet_order_id: row.pet_order_id ? String(row.pet_order_id) : null,
    scene_id: row.scene_id ? String(row.scene_id) : null,
    scene_key: row.scene_key ? String(row.scene_key) : null,
    attempt_number: Number(row.attempt_number || 1),
    is_retry: Boolean(row.is_retry),
    is_mock: Boolean(row.is_mock),
    product_sku: row.product_sku ? String(row.product_sku) : PET_PRODUCT_SKU,
    model_name: String(row.model_name || KONTEXT_PRO_MODEL),
    model_version: row.model_version ? String(row.model_version) : null,
    provider_status: String(row.provider_status || "starting"),
    pricing_method: String(row.pricing_method || KONTEXT_PRO_PRICING_METHOD),
    unit_cost_usd: toUsd(row.unit_cost_usd),
    billable_units: toUsd(row.billable_units),
    cost_usd: toUsd(row.cost_usd),
    cost_state: (String(row.cost_state || "pending") as CostState),
    pricing_source: String(row.pricing_source || KONTEXT_PRO_PRICING_SOURCE),
    tariff_snapshot: {
      provider: AI_COST_PROVIDER_REPLICATE,
      model: String(snapshot.model || row.model_name || KONTEXT_PRO_MODEL),
      modelVersion: snapshot.modelVersion ?? (row.model_version ? String(row.model_version) : null),
      pricingMethod: String(snapshot.pricingMethod || row.pricing_method || KONTEXT_PRO_PRICING_METHOD),
      unitCostUsd: toUsd(snapshot.unitCostUsd ?? row.unit_cost_usd),
      currency: "usd",
      source: String(snapshot.source || row.pricing_source || KONTEXT_PRO_PRICING_SOURCE),
      pricingRowId: snapshot.pricingRowId ?? null,
      capturedAt: String(snapshot.capturedAt || row.started_at || ""),
      notes: snapshot.notes,
    },
    currency: "usd",
    started_at: String(row.started_at || ""),
    completed_at: row.completed_at ? String(row.completed_at) : null,
    cost_notes: row.cost_notes ? String(row.cost_notes) : null,
  };
}
