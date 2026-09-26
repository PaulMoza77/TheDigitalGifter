/**
 * Provider fulfillment availability for Dog V2.
 * Prefer the same-origin VPS probe (deployed with the frontend).
 * Fall back to Supabase edge `pet-provider-status` when present.
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

/** Same-origin VPS route · primary probe after conversion rebuild. */
export const V2_PROVIDER_STATUS_ORIGIN_PATH = "/api/pet-provider-status" as const;

export function clearV2ProviderStatusCache() {
  cached = null;
}

function parseStatus(body: Record<string, unknown>, checkedAt: number): V2ProviderStatus {
  const available = body.available === true;
  const reason = typeof body.reason === "string" ? body.reason : null;
  return {
    available,
    reason,
    failureCategory: available ? null : "provider_unavailable",
    message: available
      ? "ok"
      : typeof body.message === "string" && body.message.trim()
        ? body.message
        : V2_PROVIDER_UNAVAILABLE_COPY,
    checkedAt,
  };
}

async function fetchJson(
  url: string,
  headers?: Record<string, string>,
): Promise<{
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}> {
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return { ok: res.ok, status: res.status, body };
}

export async function fetchV2ProviderStatus(force = false): Promise<V2ProviderStatus> {
  const now = Date.now();
  if (!force && cached && now - cached.checkedAt < CACHE_MS) return cached;

  try {
    // 1) Same-origin VPS probe (canonical for production frontend deploys).
    const origin = await fetchJson(V2_PROVIDER_STATUS_ORIGIN_PATH);
    const originReason = typeof origin.body.reason === "string" ? origin.body.reason : null;
    // Older deploys returned available:false for missing_token. Prefer Edge when the
    // origin probe is only misconfigured (token lives on Supabase for fulfillment).
    const originIsConfigMiss =
      origin.body.available === false &&
      (originReason === "missing_token" || originReason === "probe_token_absent");
    if (origin.status !== 404 && "available" in origin.body && !originIsConfigMiss) {
      const status = parseStatus(origin.body, now);
      cached = status;
      return status;
    }

    // 2) Fallback: Supabase Edge (when deployed).
    const { url, anon } = getPublicSupabaseConfig();
    const edge = await fetchJson(`${url.replace(/\/$/, "")}${PET_V2_PROVIDER_STATUS_PATH}`, {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    });
    if ("available" in edge.body) {
      const status = parseStatus(edge.body, now);
      cached = status;
      return status;
    }

    // Edge missing / unreachable: if the origin only lacked the probe token, allow checkout.
    if (originIsConfigMiss || (origin.status !== 404 && origin.body.available === true)) {
      const status = parseStatus(
        originIsConfigMiss
          ? { available: true, reason: "probe_token_absent", message: "ok" }
          : origin.body,
        now,
      );
      cached = status;
      return status;
    }

    const status: V2ProviderStatus = {
      available: false,
      reason: "endpoint_unreachable",
      failureCategory: "endpoint_unreachable",
      message: V2_PROVIDER_UNAVAILABLE_COPY,
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

/** Pure helper for tests · classify Replicate-style errors. */
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
