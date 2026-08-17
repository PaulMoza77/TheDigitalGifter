export const DEFAULT_REPLICATE_CREATE_INTERVAL_MS = 1200;
export const MIN_REPLICATE_CREATE_INTERVAL_MS = 1100;
export const MAX_REPLICATE_CREATE_INTERVAL_MS = 10_000;
export const DEFAULT_THROTTLE_MAX_RETRIES = 8;
export const DEFAULT_THROTTLE_BACKOFF_CAP_MS = 30_000;
export const DEFAULT_CREATE_LOCK_LEASE_MS = 90_000;
export const WAITING_FOR_PROVIDER_RATE_LIMIT = "Waiting for provider rate limit";
export const LOW_CREDIT_BURST_LIMIT = 5;

export type SceneCreateView = {
  id: string;
  sceneKey: string;
  status: string;
  attempts: number;
  replicatePredictionId: string | null;
  lastError: string | null;
};

export type CreatePredictionSuccess = { ok: true; id: string };
export type CreatePredictionFailure = {
  ok: false;
  status: number;
  error: string;
  retryAfterMs: number | null;
};
export type CreatePredictionResult = CreatePredictionSuccess | CreatePredictionFailure;

export type ProviderCreateClass = "ok" | "throttle" | "billing" | "terminal" | "retryable";

export class ReplicateHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;
  constructor(message: string, status: number, retryAfterMs: number | null = null) {
    super(message);
    this.name = "ReplicateHttpError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function isSuccessfulSceneStatus(status: string): boolean {
  return status === "succeeded" || status === "ready";
}

export function isThrottleStatus(status: number): boolean {
  return status === 429;
}

export function isThrottleMessage(message: string): boolean {
  return /throttl|rate limit|too many requests|retry later/i.test(message);
}

export function isRateLimitedScene(scene: Pick<SceneCreateView, "status" | "lastError" | "replicatePredictionId">): boolean {
  if (scene.replicatePredictionId) return false;
  if (scene.status === "rate_limited") return true;
  return isThrottleMessage(scene.lastError || "");
}

export function adminPortraitStatusLabel(scene: Pick<SceneCreateView, "status" | "lastError" | "replicatePredictionId">): string {
  if (isSuccessfulSceneStatus(scene.status)) return scene.status === "ready" ? "ready" : "succeeded";
  if (isRateLimitedScene(scene) || (scene.status === "generating" && !scene.replicatePredictionId && isThrottleMessage(scene.lastError || ""))) {
    return WAITING_FOR_PROVIDER_RATE_LIMIT;
  }
  if (scene.status === "generating") return "generating";
  if (scene.status === "queued") return "queued";
  if (scene.status === "failed") return "failed";
  return scene.status;
}

export function classifyCreateError(status: number, message = ""): ProviderCreateClass {
  if (status === 429 || isThrottleMessage(message)) return "throttle";
  if (status === 402 || /insufficient.*(credit|fund|balance)|payment required|billing required/i.test(message)) {
    return "billing";
  }
  if (status === 408 || status === 409 || status === 425 || status === 0 || status >= 500) return "retryable";
  if (status >= 400 && status < 500) return "terminal";
  return "retryable";
}

export function resolveCreateIntervalMs(raw?: string | number | null): number {
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_REPLICATE_CREATE_INTERVAL_MS;
  return Math.min(
    MAX_REPLICATE_CREATE_INTERVAL_MS,
    Math.max(MIN_REPLICATE_CREATE_INTERVAL_MS, Math.round(parsed)),
  );
}

export function selectScenesForPredictionCreate<T extends SceneCreateView>(
  scenes: T[],
  selectedKeys?: string[],
): T[] {
  return scenes.filter((scene) => {
    if (selectedKeys?.length && !selectedKeys.includes(scene.sceneKey)) return false;
    return canClaimScene(scene);
  });
}

export function canClaimScene(scene: SceneCreateView): boolean {
  if (isSuccessfulSceneStatus(scene.status)) return false;
  if (scene.replicatePredictionId) return false;
  return (
    scene.status === "queued" ||
    scene.status === "failed" ||
    scene.status === "rate_limited" ||
    scene.status === "generating"
  );
}

export function predictionAttemptNumber(
  scene: Pick<SceneCreateView, "attempts" | "replicatePredictionId" | "lastError" | "status">,
): number {
  const current = Math.max(0, Number(scene.attempts || 0));
  if (scene.replicatePredictionId) return current + 1;
  if (isRateLimitedScene(scene)) return Math.max(1, current);
  return current + 1;
}

export function remainingCreativeAttempts(
  scene: Pick<SceneCreateView, "attempts" | "replicatePredictionId" | "lastError" | "status">,
  maxAttempts = 3,
): number {
  return Math.max(0, maxAttempts - Math.max(0, Number(scene.attempts || 0)));
}

export function parseRetryAfterMs(input: {
  retryAfterHeader?: string | null;
  resetHeader?: string | null;
  body?: string;
  nowMs?: number;
}): number | null {
  const now = input.nowMs ?? Date.now();
  const header = String(input.retryAfterHeader || "").trim();
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
    const dateMs = Date.parse(header);
    if (Number.isFinite(dateMs)) return Math.max(0, dateMs - now);
  }
  const reset = String(input.resetHeader || "").trim();
  if (reset) {
    const unix = Number(reset);
    if (Number.isFinite(unix)) {
      const resetMs = unix > 1e12 ? unix : unix * 1000;
      return Math.max(0, resetMs - now);
    }
  }
  const match = String(input.body || "").match(/resets? in ~?(\d+)\s*s/i);
  if (match) return Number(match[1]) * 1000;
  return null;
}

export function throttleBackoffMs(
  retryIndex: number,
  retryAfterMs: number | null,
  random: () => number = Math.random,
): number {
  const exp = Math.min(DEFAULT_THROTTLE_BACKOFF_CAP_MS, 1000 * 2 ** Math.max(0, retryIndex));
  const jitter = Math.floor(Math.max(0, Math.min(1, random())) * 250);
  return Math.min(DEFAULT_THROTTLE_BACKOFF_CAP_MS, Math.max(retryAfterMs ?? 0, exp) + jitter);
}

export function shouldRetryCreate(retryCount: number, maxRetries = DEFAULT_THROTTLE_MAX_RETRIES): boolean {
  return retryCount < maxRetries;
}

export class PredictionCreatePacer {
  private nextAt = 0;
  constructor(
    private readonly intervalMs: number,
    private readonly now: () => number,
    private readonly wait: (ms: number) => Promise<void>,
  ) {}

  async beforeCreate(): Promise<void> {
    const waitMs = Math.max(0, this.nextAt - this.now());
    if (waitMs > 0) await this.wait(waitMs);
  }

  markCreated(): void {
    this.nextAt = this.now() + this.intervalMs;
  }
}

export class OrderCreateLock {
  private holder: string | null = null;
  private expiresAt = 0;
  constructor(
    private readonly now: () => number,
    private readonly leaseMs = DEFAULT_CREATE_LOCK_LEASE_MS,
  ) {}

  claim(holder: string): boolean {
    const t = this.now();
    if (this.holder && this.expiresAt > t && this.holder !== holder) return false;
    this.holder = holder;
    this.expiresAt = t + this.leaseMs;
    return true;
  }

  release(holder: string): void {
    if (this.holder === holder) {
      this.holder = null;
      this.expiresAt = 0;
    }
  }
}

export async function createPredictionWithRetry(input: {
  create: () => Promise<CreatePredictionResult>;
  pacer: PredictionCreatePacer;
  wait: (ms: number) => Promise<void>;
  random?: () => number;
  maxRetries?: number;
  now?: () => number;
}): Promise<CreatePredictionResult> {
  const maxRetries = input.maxRetries ?? DEFAULT_THROTTLE_MAX_RETRIES;
  const random = input.random ?? Math.random;
  let retryCount = 0;
  while (true) {
    await input.pacer.beforeCreate();
    const result = await input.create();
    input.pacer.markCreated();
    if (result.ok) return result;
    const kind = classifyCreateError(result.status, result.error);
    if ((kind !== "throttle" && kind !== "retryable") || !shouldRetryCreate(retryCount, maxRetries)) {
      return result;
    }
    const delay = throttleBackoffMs(retryCount, result.retryAfterMs, random);
    retryCount += 1;
    await input.wait(delay);
  }
}

export async function runEligibleSceneCreates<T extends SceneCreateView>(input: {
  scenes: T[];
  selectedKeys?: string[];
  intervalMs?: number;
  maxThrottleRetries?: number;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  random?: () => number;
  lock?: OrderCreateLock;
  lockHolder?: string;
  abortAfterStarted?: number;
  abortBeforeCreate?: (scene: T, started: number) => boolean;
  claim: (scene: T) => Promise<T | null>;
  create: (scene: T) => Promise<CreatePredictionResult>;
  onPrediction: (scene: T, predictionId: string, attemptNumber: number) => Promise<void>;
  onThrottleExhausted: (scene: T, error: string) => Promise<void>;
  onRetryableExhausted?: (scene: T, error: string) => Promise<void>;
  onBillingRequired?: (scene: T, error: string) => Promise<void>;
  onPermanentFailure: (scene: T, error: string, attemptNumber: number) => Promise<void>;
}): Promise<{ started: number; skipped: number; eligible: number; locked: boolean; billingRequired: boolean }> {
  const eligible = selectScenesForPredictionCreate(input.scenes, input.selectedKeys);
  const skipped = input.scenes.length - eligible.length;
  const empty = { started: 0, skipped, eligible: eligible.length, locked: false, billingRequired: false };
  const holder = input.lockHolder || "create";
  if (input.lock && !input.lock.claim(holder)) {
    return { ...empty, locked: true };
  }
  const now = input.now ?? Date.now;
  const wait = input.wait ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const pacer = new PredictionCreatePacer(
    resolveCreateIntervalMs(input.intervalMs ?? DEFAULT_REPLICATE_CREATE_INTERVAL_MS),
    now,
    wait,
  );
  let started = 0;
  let billingRequired = false;
  try {
    for (const scene of eligible) {
      if (typeof input.abortAfterStarted === "number" && started >= input.abortAfterStarted) break;
      const claimed = await input.claim(scene);
      if (!claimed) continue;
      if (isSuccessfulSceneStatus(claimed.status) || claimed.replicatePredictionId) continue;
      if (input.abortBeforeCreate?.(claimed, started)) break;
      const attemptNumber = predictionAttemptNumber({
        attempts: scene.attempts,
        replicatePredictionId: claimed.replicatePredictionId,
        lastError: scene.lastError,
        status: scene.status,
      });
      const result = await createPredictionWithRetry({
        create: () => input.create(claimed),
        pacer,
        wait,
        random: input.random,
        maxRetries: input.maxThrottleRetries,
        now,
      });
      if (result.ok && result.id) {
        await input.onPrediction(claimed, result.id, attemptNumber);
        started += 1;
        continue;
      }
      const kind = classifyCreateError(result.ok ? 500 : result.status, result.ok ? "missing prediction id" : result.error);
      const error = result.ok ? "missing prediction id" : result.error;
      if (kind === "billing") {
        await (input.onBillingRequired ?? input.onThrottleExhausted)(claimed, error);
        billingRequired = true;
        break;
      }
      if (kind === "throttle") {
        await input.onThrottleExhausted(claimed, error);
        break;
      }
      if (kind === "retryable") {
        await (input.onRetryableExhausted ?? input.onThrottleExhausted)(claimed, error);
        continue;
      }
      await input.onPermanentFailure(claimed, error, attemptNumber);
    }
  } finally {
    input.lock?.release(holder);
  }
  return { started, skipped, eligible: eligible.length, locked: false, billingRequired };
}
