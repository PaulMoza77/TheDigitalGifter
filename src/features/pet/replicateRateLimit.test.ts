import { describe, expect, it } from "vitest";
import { AiCostLedgerStore, applyIdempotentLedgerWrite, buildPendingLedgerRow, snapshotKontextProTariff } from "./aiCost";
import { generationBatchState } from "./funnelGuards";
import {
  DEFAULT_REPLICATE_CREATE_INTERVAL_MS,
  LOW_CREDIT_BURST_LIMIT,
  MIN_REPLICATE_CREATE_INTERVAL_MS,
  OrderCreateLock,
  WAITING_FOR_PROVIDER_RATE_LIMIT,
  adminPortraitStatusLabel,
  canClaimScene,
  classifyCreateError,
  createPredictionWithRetry,
  parseRetryAfterMs,
  predictionAttemptNumber,
  remainingCreativeAttempts,
  runEligibleSceneCreates,
  selectScenesForPredictionCreate,
  throttleBackoffMs,
  type CreatePredictionResult,
  type SceneCreateView,
} from "./replicateRateLimit";

const KEYS = [
  "royal-portrait",
  "luxury-ceo",
  "astronaut",
  "formula-racer",
  "spa-bathtub",
  "newspaper",
  "cinema-boss",
  "renaissance",
  "beach-vacation",
  "head-chef",
  "original-superhero",
  "christmas-portrait",
] as const;

function scene(input: Partial<SceneCreateView> & { sceneKey: string }): SceneCreateView {
  return {
    id: input.id || input.sceneKey,
    sceneKey: input.sceneKey,
    status: input.status || "queued",
    attempts: input.attempts ?? 0,
    replicatePredictionId: input.replicatePredictionId ?? null,
    lastError: input.lastError ?? null,
  };
}

function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    wait: async (ms: number) => {
      t += Math.max(0, ms);
    },
    get time() {
      return t;
    },
  };
}

function burstLimiter(limit: number, windowMs: number, clock: { now: () => number }) {
  const stamps: number[] = [];
  let seq = 0;
  return {
    stamps,
    tryCreate(): CreatePredictionResult {
      const now = clock.now();
      while (stamps.length && now - stamps[0] >= windowMs) stamps.shift();
      if (stamps.length >= limit) {
        const retryAfterMs = windowMs - (now - stamps[0]);
        return {
          ok: false,
          status: 429,
          error: `Request was throttled. Your rate limit is reduced to 60/min with a burst of ${limit} while credit is under $10. resets in ~${Math.max(1, Math.ceil(retryAfterMs / 1000))}s`,
          retryAfterMs,
        };
      }
      stamps.push(now);
      seq += 1;
      return { ok: true, id: `pred-${seq}` };
    },
  };
}

class SceneStore {
  readonly scenes: Map<string, SceneCreateView>;
  readonly ledger: Array<{ predictionId: string; sceneKey: string; attemptNumber: number; createFailed?: boolean }> = [];
  readonly createTimes: number[] = [];
  constructor(scenes: SceneCreateView[]) {
    this.scenes = new Map(scenes.map((item) => [item.id, { ...item }]));
  }
  claim(id: string): SceneCreateView | null {
    const current = this.scenes.get(id);
    if (!current || !canClaimScene(current)) return null;
    const next = { ...current, status: "generating", lastError: null };
    this.scenes.set(id, next);
    return { ...next };
  }
}

async function runStore(
  store: SceneStore,
  opts: {
    clock: ReturnType<typeof fakeClock>;
    create: (scene: SceneCreateView) => Promise<CreatePredictionResult>;
    intervalMs?: number;
    selectedKeys?: string[];
    maxThrottleRetries?: number;
    lock?: OrderCreateLock;
    lockHolder?: string;
    abortAfterStarted?: number;
    abortBeforeCreate?: (scene: SceneCreateView, started: number) => boolean;
  },
) {
  return runEligibleSceneCreates({
    scenes: [...store.scenes.values()],
    selectedKeys: opts.selectedKeys,
    intervalMs: opts.intervalMs ?? DEFAULT_REPLICATE_CREATE_INTERVAL_MS,
    maxThrottleRetries: opts.maxThrottleRetries,
    now: opts.clock.now,
    wait: opts.clock.wait,
    random: () => 0,
    lock: opts.lock,
    lockHolder: opts.lockHolder,
    abortAfterStarted: opts.abortAfterStarted,
    abortBeforeCreate: opts.abortBeforeCreate,
    claim: async (item) => store.claim(item.id),
    create: async (item) => {
      store.createTimes.push(opts.clock.now());
      return opts.create(item);
    },
    onPrediction: async (item, predictionId, attemptNumber) => {
      const current = store.scenes.get(item.id);
      if (!current || current.status === "succeeded" || current.status === "ready" || current.replicatePredictionId) {
        return;
      }
      store.scenes.set(item.id, {
        ...current,
        status: "generating",
        replicatePredictionId: predictionId,
        attempts: attemptNumber,
        lastError: null,
      });
      store.ledger.push({ predictionId, sceneKey: item.sceneKey, attemptNumber });
    },
    onThrottleExhausted: async (item, error) => {
      const current = store.scenes.get(item.id);
      if (!current || current.replicatePredictionId) return;
      store.scenes.set(item.id, {
        ...current,
        status: "rate_limited",
        lastError: error,
      });
    },
    onRetryableExhausted: async (item, error) => {
      const current = store.scenes.get(item.id);
      if (!current || current.replicatePredictionId) return;
      store.scenes.set(item.id, { ...current, status: "queued", lastError: error });
    },
    onBillingRequired: async (item, error) => {
      const current = store.scenes.get(item.id);
      if (!current || current.replicatePredictionId) return;
      store.scenes.set(item.id, { ...current, status: "queued", lastError: error });
    },
    onPermanentFailure: async (item, error, attemptNumber) => {
      const current = store.scenes.get(item.id);
      if (!current || current.status === "succeeded" || current.status === "ready") return;
      store.scenes.set(item.id, {
        ...current,
        status: "failed",
        lastError: error,
        attempts: attemptNumber,
      });
      store.ledger.push({
        predictionId: `create-failed:${item.id}`,
        sceneKey: item.sceneKey,
        attemptNumber,
        createFailed: true,
      });
    },
  });
}

describe("Replicate prediction-create rate limit", () => {
  it("keeps the default create interval at 1200ms in the 1100–1250ms band", () => {
    expect(DEFAULT_REPLICATE_CREATE_INTERVAL_MS).toBe(1200);
    expect(DEFAULT_REPLICATE_CREATE_INTERVAL_MS).toBeGreaterThanOrEqual(MIN_REPLICATE_CREATE_INTERVAL_MS);
    expect(DEFAULT_REPLICATE_CREATE_INTERVAL_MS).toBeLessThanOrEqual(1250);
  });

  it("classifies 429, billing, terminal 4xx, and 5xx/network separately", () => {
    expect(classifyCreateError(429, "throttled")).toBe("throttle");
    expect(classifyCreateError(402, "Insufficient credit")).toBe("billing");
    expect(classifyCreateError(422, "invalid prompt")).toBe("terminal");
    expect(classifyCreateError(400, "Bad input")).toBe("terminal");
    expect(classifyCreateError(500, "upstream")).toBe("retryable");
    expect(classifyCreateError(0, "network")).toBe("retryable");
  });

  it("parses Retry-After seconds, reset headers, and body reset hints", () => {
    expect(parseRetryAfterMs({ retryAfterHeader: "5" })).toBe(5000);
    expect(parseRetryAfterMs({ body: "Your rate limit resets in ~5s" })).toBe(5000);
    expect(parseRetryAfterMs({ resetHeader: "100", nowMs: 90_000 })).toBe(10_000);
  });

  it("respects Retry-After over the exponential floor", () => {
    expect(throttleBackoffMs(0, 7000, () => 0)).toBe(7000);
    expect(throttleBackoffMs(0, null, () => 0)).toBe(1000);
  });

  it("does not count a provider throttle as a creative attempt", () => {
    expect(
      predictionAttemptNumber({
        attempts: 1,
        replicatePredictionId: null,
        lastError: "Request was throttled. Your rate limit for creating predictions is reduced to 60 requests per minute with a burst of 5",
        status: "rate_limited",
      }),
    ).toBe(1);
    expect(predictionAttemptNumber({ attempts: 0, replicatePredictionId: null, lastError: null, status: "queued" })).toBe(1);
  });

  it("creates all 12 scenes under a $5/low-credit burst limit of 5 when paced", async () => {
    const clock = fakeClock();
    const limiter = burstLimiter(LOW_CREDIT_BURST_LIMIT, 60_000, clock);
    const store = new SceneStore(KEYS.map((sceneKey) => scene({ sceneKey, status: "queued" })));
    const result = await runStore(store, {
      clock,
      intervalMs: DEFAULT_REPLICATE_CREATE_INTERVAL_MS,
      create: async () => limiter.tryCreate(),
    });
    expect(result.started).toBe(12);
    expect([...store.scenes.values()].every((item) => item.replicatePredictionId)).toBe(true);
    expect(store.ledger).toHaveLength(12);
    expect(new Set(store.ledger.map((row) => row.predictionId)).size).toBe(12);
    const gaps = store.createTimes.slice(1).map((time, index) => time - store.createTimes[index]);
    expect(gaps.every((gap) => gap >= DEFAULT_REPLICATE_CREATE_INTERVAL_MS)).toBe(true);
    expect(store.createTimes[11] - store.createTimes[0]).toBeGreaterThanOrEqual(11 * DEFAULT_REPLICATE_CREATE_INTERVAL_MS);
  });

  it("retries a 429 and then succeeds without marking the scene failed", async () => {
    const clock = fakeClock();
    let calls = 0;
    const store = new SceneStore([scene({ sceneKey: "spa-bathtub", status: "failed", attempts: 1, lastError: "throttled" })]);
    await runStore(store, {
      clock,
      create: async () => {
        calls += 1;
        if (calls === 1) {
          return { ok: false, status: 429, error: "throttled", retryAfterMs: 5000 };
        }
        return { ok: true, id: "pred-ok" };
      },
    });
    const updated = store.scenes.get("spa-bathtub");
    expect(calls).toBe(2);
    expect(updated?.replicatePredictionId).toBe("pred-ok");
    expect(updated?.status).not.toBe("failed");
    expect(updated?.attempts).toBe(1);
    expect(store.ledger).toEqual([{ predictionId: "pred-ok", sceneKey: "spa-bathtub", attemptNumber: 1 }]);
  });

  it("leaves a scene rate_limited after repeated 429s with no prediction, ledger, or partial_failure", async () => {
    const clock = fakeClock();
    const store = new SceneStore([
      scene({ sceneKey: "royal-portrait", status: "succeeded", attempts: 1, replicatePredictionId: "keep-1" }),
      scene({ sceneKey: "cinema-boss", status: "failed", attempts: 1, lastError: "throttled" }),
    ]);
    await runStore(store, {
      clock,
      maxThrottleRetries: 2,
      create: async () => ({ ok: false, status: 429, error: "still throttled", retryAfterMs: 1000 }),
    });
    const updated = store.scenes.get("cinema-boss");
    expect(updated?.status).toBe("rate_limited");
    expect(updated?.replicatePredictionId).toBeNull();
    expect(updated?.attempts).toBe(1);
    expect(store.ledger).toHaveLength(0);
    expect(selectScenesForPredictionCreate([updated!])).toHaveLength(1);
    expect(generationBatchState([...store.scenes.values()])).toBe("generating");
    expect(adminPortraitStatusLabel(updated!)).toBe(WAITING_FOR_PROVIDER_RATE_LIMIT);
  });

  it("does not consume the three creative retries when 429s are retried", async () => {
    const clock = fakeClock();
    const store = new SceneStore([scene({ sceneKey: "renaissance", status: "queued", attempts: 0 })]);
    await runStore(store, {
      clock,
      maxThrottleRetries: 3,
      create: async () => ({ ok: false, status: 429, error: "throttled", retryAfterMs: 1000 }),
    });
    const updated = store.scenes.get("renaissance")!;
    expect(updated.status).toBe("rate_limited");
    expect(updated.attempts).toBe(0);
    expect(remainingCreativeAttempts(updated, 3)).toBe(3);
    expect(store.ledger.filter((row) => row.createFailed)).toHaveLength(0);
  });

  it("skips successful scenes and does not create duplicate predictions", async () => {
    const clock = fakeClock();
    const store = new SceneStore([
      scene({ sceneKey: "royal-portrait", status: "succeeded", attempts: 1, replicatePredictionId: "keep-1" }),
      scene({ sceneKey: "luxury-ceo", status: "succeeded", attempts: 1, replicatePredictionId: "keep-2" }),
      scene({ sceneKey: "spa-bathtub", status: "failed", attempts: 1, lastError: "throttled" }),
    ]);
    const created: string[] = [];
    await runStore(store, {
      clock,
      create: async (item) => {
        created.push(item.sceneKey);
        return { ok: true, id: `new-${item.sceneKey}` };
      },
    });
    expect(created).toEqual(["spa-bathtub"]);
    expect(store.scenes.get("royal-portrait")?.replicatePredictionId).toBe("keep-1");
    expect(store.scenes.get("luxury-ceo")?.replicatePredictionId).toBe("keep-2");
    expect(store.ledger).toHaveLength(1);
  });

  it("prevents concurrent invocations from claiming the same scene twice", async () => {
    const clock = fakeClock();
    const store = new SceneStore(
      KEYS.slice(0, 6).map((sceneKey) => scene({ sceneKey, status: "failed", attempts: 1, lastError: "throttled" })),
    );
    const lock = new OrderCreateLock(clock.now, 90_000);
    let claimLock = Promise.resolve();
    const claim = async (item: SceneCreateView) => {
      const previous = claimLock;
      let release = () => {};
      claimLock = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return store.claim(item.id);
      } finally {
        release();
      }
    };
    const create = async (item: SceneCreateView): Promise<CreatePredictionResult> => ({
      ok: true,
      id: `pred-${item.sceneKey}`,
    });
    const run = (holder: string) =>
      runEligibleSceneCreates({
        scenes: [...store.scenes.values()],
        intervalMs: DEFAULT_REPLICATE_CREATE_INTERVAL_MS,
        now: clock.now,
        wait: clock.wait,
        random: () => 0,
        lock,
        lockHolder: holder,
        claim,
        create,
        onPrediction: async (item, predictionId, attemptNumber) => {
          const current = store.scenes.get(item.id);
          if (!current || current.replicatePredictionId) return;
          store.scenes.set(item.id, {
            ...current,
            replicatePredictionId: predictionId,
            attempts: attemptNumber,
          });
          store.ledger.push({ predictionId, sceneKey: item.sceneKey, attemptNumber });
        },
        onThrottleExhausted: async () => {},
        onPermanentFailure: async () => {},
      });
    const [first, second] = await Promise.all([run("a"), run("b")]);
    expect(first.locked || second.locked).toBe(true);
    expect(first.started + second.started).toBe(6);
    expect(store.ledger).toHaveLength(6);
    expect(new Set(store.ledger.map((row) => row.predictionId)).size).toBe(6);
    expect(new Set(store.ledger.map((row) => row.sceneKey)).size).toBe(6);
  });

  it("resumes only scenes without prediction IDs after an interrupted invocation", async () => {
    const clock = fakeClock();
    const store = new SceneStore(KEYS.map((sceneKey) => scene({ sceneKey, status: "queued" })));
    let seq = 0;
    const create = async (): Promise<CreatePredictionResult> => {
      seq += 1;
      return { ok: true, id: `pred-${seq}` };
    };
    const first = await runStore(store, { clock, create, abortAfterStarted: 3 });
    expect(first.started).toBe(3);
    const interrupted = store.scenes.get("formula-racer")!;
    store.scenes.set("formula-racer", { ...interrupted, status: "generating", replicatePredictionId: null });
    const second = await runStore(store, { clock, create });
    expect(second.started).toBe(9);
    const values = [...store.scenes.values()];
    expect(values.filter((item) => item.replicatePredictionId).length).toBe(12);
    expect(new Set(store.ledger.map((row) => row.predictionId)).size).toBe(12);
    expect(store.ledger).toHaveLength(12);
  });

  it("does not write duplicate ledger rows for the same prediction id", () => {
    const store = new AiCostLedgerStore();
    const row = buildPendingLedgerRow({
      id: "row-1",
      predictionId: "pred-dup",
      orderId: "order-1",
      sceneKey: "royal-portrait",
      attemptNumber: 1,
      tariff: snapshotKontextProTariff({ capturedAt: "2026-08-17T00:00:00.000Z" }),
      startedAt: "2026-08-17T18:52:00.000Z",
    });
    store.recordAttempt(row);
    store.recordAttempt(row);
    expect(store.all()).toHaveLength(1);
    expect(applyIdempotentLedgerWrite(store.get("replicate", "pred-dup") ?? null, row).id).toBe("row-1");
  });

  it("keeps a successful create after an earlier 429 in createPredictionWithRetry", async () => {
    const clock = fakeClock();
    const { PredictionCreatePacer } = await import("./replicateRateLimit");
    const pacer = new PredictionCreatePacer(1200, clock.now, clock.wait);
    let calls = 0;
    const result = await createPredictionWithRetry({
      pacer,
      wait: clock.wait,
      random: () => 0,
      create: async () => {
        calls += 1;
        if (calls === 1) return { ok: false, status: 429, error: "throttled", retryAfterMs: 2000 };
        return { ok: true, id: "pred-2" };
      },
    });
    expect(result).toEqual({ ok: true, id: "pred-2" });
    expect(calls).toBe(2);
  });

  it("holds billing_required without failing scenes or writing create_failed ledger rows", async () => {
    const clock = fakeClock();
    const store = new SceneStore(KEYS.map((sceneKey) => scene({ sceneKey, status: "queued" })));
    const result = await runStore(store, {
      clock,
      create: async () => ({ ok: false, status: 402, error: "Insufficient credit", retryAfterMs: null }),
    });
    expect(result.billingRequired).toBe(true);
    expect(result.started).toBe(0);
    expect(store.ledger).toHaveLength(0);
    expect([...store.scenes.values()].every((item) => item.status !== "failed")).toBe(true);
  });
});
