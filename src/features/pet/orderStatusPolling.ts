import { PetApiError } from "./api";
import type { PetGenerationProgress, PetOrder, PetOrderStatus } from "./types";

export const ORDER_POLL_INTERVAL_MS = 8_000;
export const ORDER_POLL_TIMEOUT_MS = 12_000;

const TERMINAL_ORDER_STATUSES: readonly PetOrderStatus[] = [
  "complete",
  "failed",
  "refunded",
  "canceled",
];

export function isTerminalOrderStatus(status: string | undefined): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status as PetOrderStatus);
}

export function shouldKeepPolling(status: string | undefined): boolean {
  return !isTerminalOrderStatus(status);
}

export function isFatalOrderLookupError(error: unknown): boolean {
  if (!(error instanceof PetApiError)) return false;
  return error.code === "ORDER_NOT_FOUND" || error.code === "PET_API_NOT_CONNECTED";
}

export function isTransientPollError(error: unknown): boolean {
  if (error instanceof PetApiError) {
    if (error.code === "ORDER_NOT_FOUND") return false;
    if (error.status === 404) return false;
    if (error.status === 429 || error.status === 408 || error.status >= 500) return true;
    return /too many requests|timed out|network|failed to fetch/i.test(error.message);
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") return true;
    return /failed to fetch|networkerror|timed out|abort/i.test(error.message);
  }
  return true;
}

export function mergeOrderWithProgress(order: PetOrder, progress: PetGenerationProgress): PetOrder {
  return {
    ...order,
    status: progress.orderStatus || order.status,
    phase: progress.phase && progress.phase !== "other" ? progress.phase : order.phase,
    scenes: progress.scenes.length ? progress.scenes : order.scenes,
    clips: progress.clips.length ? progress.clips : order.clips,
  };
}

export async function withTimeout<T>(promise: Promise<T>, ms = ORDER_POLL_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  void promise.catch(() => undefined);
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new PetApiError("INVALID_REQUEST", "Status check timed out.", 408));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
