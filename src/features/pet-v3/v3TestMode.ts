import { getPetV3SessionId, resetPetV3SessionId } from "./session";

const STATUS_PATH = "/api/pet-v3/internal-test-status";

export type V3InternalTestStatus = {
  authorized: boolean;
  expiresAt: string | null;
};

/** Server-authoritative internal test flag for this browser session (never localStorage). */
export async function fetchV3InternalTestStatus(sessionId?: string): Promise<V3InternalTestStatus> {
  const id = sessionId || getPetV3SessionId();
  if (typeof fetch !== "function") return { authorized: false, expiresAt: null };
  try {
    const response = await fetch(STATUS_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funnel_session_id: id }),
      credentials: "same-origin",
    });
    if (!response.ok) return { authorized: false, expiresAt: null };
    const payload = (await response.json()) as V3InternalTestStatus;
    return {
      authorized: Boolean(payload.authorized),
      expiresAt: payload.expiresAt ? String(payload.expiresAt) : null,
    };
  } catch {
    return { authorized: false, expiresAt: null };
  }
}

/**
 * Disable client-side test UI by rotating to a fresh anonymous session.
 * Removing server registration requires admin RPC (dashboard).
 */
export function exitV3InternalTestBrowserSession(): string {
  return resetPetV3SessionId();
}

/** @deprecated Client flags are not authoritative. Use fetchV3InternalTestStatus(). */
export function isV3AnalyticsTestModeActive(): boolean {
  return false;
}

/** @deprecated Client cannot self-authorize test mode. */
export function syncV3AnalyticsTestModeFromQuery(): boolean {
  return false;
}

/** @deprecated */
export function setV3AnalyticsTestMode(_enabled: boolean): void {
  /* no-op — server registration required */
}

/** @deprecated */
export function clearV3AnalyticsTestMode(): void {
  exitV3InternalTestBrowserSession();
}
