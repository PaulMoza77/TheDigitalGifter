export const CHRISTMAS_JOIN_PENDING_KEY = "tdg.christmas.join.pending.v1";
export const CHRISTMAS_JOIN_OPTIN_KEY = "tdg.christmas.join.optin.v1";

export function rememberChristmasJoinPending(marketingOptIn = false) {
  try {
    window.sessionStorage.setItem(CHRISTMAS_JOIN_PENDING_KEY, "google");
    window.sessionStorage.setItem(CHRISTMAS_JOIN_OPTIN_KEY, marketingOptIn ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function takeChristmasJoinPending(): boolean {
  try {
    const value = window.sessionStorage.getItem(CHRISTMAS_JOIN_PENDING_KEY);
    window.sessionStorage.removeItem(CHRISTMAS_JOIN_PENDING_KEY);
    return value === "google";
  } catch {
    return false;
  }
}

export function peekChristmasJoinPending(): boolean {
  try {
    return window.sessionStorage.getItem(CHRISTMAS_JOIN_PENDING_KEY) === "google";
  } catch {
    return false;
  }
}

export function peekChristmasJoinOptIn(): boolean {
  try {
    return window.sessionStorage.getItem(CHRISTMAS_JOIN_OPTIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearChristmasJoinOptIn() {
  try {
    window.sessionStorage.removeItem(CHRISTMAS_JOIN_OPTIN_KEY);
  } catch {
    /* private mode */
  }
}

export function clearChristmasJoinQuery() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("join")) return;
    url.searchParams.delete("join");
    const search = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
  } catch {
    /* ignore */
  }
}

export function christmasAuthCallbackUrl(): string {
  const origin =
    typeof window !== "undefined" && window.location.hostname === "thedigitalgifter.com"
      ? "https://www.thedigitalgifter.com"
      : typeof window !== "undefined"
        ? window.location.origin
        : "https://www.thedigitalgifter.com";
  return `${origin}/auth/callback`;
}
