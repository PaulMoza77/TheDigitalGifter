/**
 * Provider fulfillment availability for Dog V2.
 * Prevents charging when Replicate (or forced kill-switch) cannot fulfill paid generation.
 */
import { getPublicSupabaseConfig } from "@/lib/env";
import { PET_V2_PROVIDER_STATUS_PATH, V2_PROVIDER_UNAVAILABLE_COPY } from "./types";

export type V2ProviderStatus = {
  available: boolean;
  reason: string | null;
  failureCategory: "provider_unavailable" | "endpoint_unreachable" | null;
  message: string;
  checkedAt: number;
};

const CACHE_MS = 60_000;
let cached: V2ProviderStatus | null = null;

export function clearV2ProviderStatusCache() {
  cached = null;
}

export async function fetchV2ProviderStatus(force = false): Promise<V2ProviderStatus> {
  const now = Date.now();
  if (!force && cached && now - cached.checkedAt < CACHE_MS) return cached;

  try {
    const { url, anon } = getPublicSupabaseConfig();
    const res = await fetch(`${url.replace(/\/$/, "")}${PET_V2_PROVIDER_STATUS_PATH}`, {
      method: "GET",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const available = body.available === true;
    const reason = typeof body.reason === "string" ? body.reason : null;
    const status: V2ProviderStatus = {
      available,
      reason,
      failureCategory: available ? null : "provider_unavailable",
      message: available
        ? "ok"
        : typeof body.message === "string" && body.message.trim()
          ? body.message
          : V2_PROVIDER_UNAVAILABLE_COPY,
      checkedAt: now,
    };
    cached = status;
    return status;
  } catch {
    const status: V2ProviderStatus = {
      available: false,
      reason: "endpoint_unreachable",
      failureCategory: "endpoint_unreachable",
      message: V2_PROVIDER_UNAVAILABLE_COPY,
      checkedAt: now,
    };
    cached = status;
    return status;
  }
}

/** Pure helper for tests — classify Replicate-style errors. */
export function classifyProviderAvailabilityError(detail: string | null | undefined): {
  available: false;
  reason: "insufficient_credit" | "rate_limited" | "provider_error" | "unknown";
} {
  const text = String(detail || "").toLowerCase();
  if (text.includes("insufficient credit") || text.includes("402")) {
    return { available: false, reason: "insufficient_credit" };
  }
  if (text.includes("429") || text.includes("rate limit")) {
    return { available: false, reason: "rate_limited" };
  }
  if (text.includes("5xx") || text.includes("500") || text.includes("502") || text.includes("503")) {
    return { available: false, reason: "provider_error" };
  }
  return { available: false, reason: "unknown" };
}
