const V3_TEST_MODE_KEY = "tdg.petFunnelV3.analyticsTestMode.v1";
const QUERY_FLAG = "tdg_funnel_test";
const TOKEN_QUERY = "tdg_analytics_test_token";

function readStorage(storage: Storage | undefined): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(V3_TEST_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStorage(storage: Storage | undefined, enabled: boolean) {
  if (!storage) return;
  try {
    if (enabled) storage.setItem(V3_TEST_MODE_KEY, "1");
    else storage.removeItem(V3_TEST_MODE_KEY);
  } catch {
    /* private mode */
  }
}

function queryEnablesTestMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get(QUERY_FLAG) === "1") return true;
    const token = String(params.get(TOKEN_QUERY) || "").trim();
    const expected = String(import.meta.env.VITE_PET_V3_ANALYTICS_TEST_TOKEN || "").trim();
    return Boolean(token && expected && token === expected);
  } catch {
    return false;
  }
}

/** Persist analytics test mode for this browser (survives navigation/reload). */
export function syncV3AnalyticsTestModeFromQuery(): boolean {
  if (typeof window === "undefined") return false;
  const enabled = queryEnablesTestMode();
  if (enabled) {
    writeStorage(window.sessionStorage, true);
    writeStorage(window.localStorage, true);
  }
  return enabled;
}

export function isV3AnalyticsTestModeActive(): boolean {
  if (typeof window === "undefined") return false;
  syncV3AnalyticsTestModeFromQuery();
  return readStorage(window.sessionStorage) || readStorage(window.localStorage);
}

export function setV3AnalyticsTestMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  writeStorage(window.sessionStorage, enabled);
  writeStorage(window.localStorage, enabled);
}

export function clearV3AnalyticsTestMode(): void {
  setV3AnalyticsTestMode(false);
}
