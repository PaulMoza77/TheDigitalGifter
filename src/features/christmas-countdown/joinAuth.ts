export const CHRISTMAS_JOIN_PENDING_KEY = "tdg.christmas.join.pending.v1";

export function rememberChristmasJoinPending() {
  try {
    window.sessionStorage.setItem(CHRISTMAS_JOIN_PENDING_KEY, "google");
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

export function christmasAuthCallbackUrl(): string {
  const origin =
    typeof window !== "undefined" && window.location.hostname === "thedigitalgifter.com"
      ? "https://www.thedigitalgifter.com"
      : typeof window !== "undefined"
        ? window.location.origin
        : "https://www.thedigitalgifter.com";
  return `${origin}/auth/callback`;
}
