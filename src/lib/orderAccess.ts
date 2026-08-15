const ORDER_KEY_PREFIX = "tdg.orderAccess.";
const REDEEM_KEY_PREFIX = "tdg.orderRedeem.";
const RESULT_PATH = "/funnel/result";
const AUTH_CALLBACK_PATH = "/auth/callback";
export const REDEEM_BOOTSTRAP_TIMEOUT_MS = 8000;

export function abortAfter(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

export function orderAccessStorageKey(orderId: string): string {
  return `${ORDER_KEY_PREFIX}${orderId}`;
}

export function orderRedeemStorageKey(orderId: string): string {
  return `${REDEEM_KEY_PREFIX}${orderId}`;
}

export function isResultAccessPath(pathname: string): boolean {
  const path = String(pathname || "").split("?")[0];
  return path === RESULT_PATH || path.endsWith(RESULT_PATH);
}

export function isAuthCallbackPath(pathname: string): boolean {
  const path = String(pathname || "").split("?")[0];
  return path === AUTH_CALLBACK_PATH || path.endsWith(AUTH_CALLBACK_PATH);
}

export function shouldCaptureOrderAccess(href: string): boolean {
  try {
    const url = new URL(href, "https://www.thedigitalgifter.com");
    if (isAuthCallbackPath(url.pathname)) return false;
    if (!isResultAccessPath(url.pathname)) return false;
    return Boolean(String(url.searchParams.get("order_id") || "").trim());
  } catch {
    return false;
  }
}

export function readOrderAccessToken(orderId: string): string {
  if (typeof sessionStorage === "undefined" || !orderId) return "";
  return String(sessionStorage.getItem(orderAccessStorageKey(orderId)) || "").trim();
}

export function storeOrderAccessToken(orderId: string, token: string): void {
  if (typeof sessionStorage === "undefined" || !orderId || !token) return;
  sessionStorage.setItem(orderAccessStorageKey(orderId), token);
}

export function readOrderRedeemCode(orderId: string): string {
  if (typeof sessionStorage === "undefined" || !orderId) return "";
  return String(sessionStorage.getItem(orderRedeemStorageKey(orderId)) || "").trim();
}

export function storeOrderRedeemCode(orderId: string, code: string): void {
  if (typeof sessionStorage === "undefined" || !orderId || !code) return;
  sessionStorage.setItem(orderRedeemStorageKey(orderId), code);
}

export function clearOrderRedeemCode(orderId: string): void {
  if (typeof sessionStorage === "undefined" || !orderId) return;
  sessionStorage.removeItem(orderRedeemStorageKey(orderId));
}

export function parseAccessFragment(hash: string): string {
  const raw = String(hash || "").replace(/^#/, "");
  if (!raw) return "";
  if (raw.startsWith("t=")) {
    return decodeURIComponent(raw.slice(2).split("&")[0] || "");
  }
  const params = new URLSearchParams(raw);
  return String(params.get("t") || "").trim();
}

export function captureResultHashToken(args: {
  pathname: string;
  search: string;
  hash: string;
}): { orderId: string; token: string; shouldStripHash: boolean } {
  if (!isResultAccessPath(args.pathname) || isAuthCallbackPath(args.pathname)) {
    return { orderId: "", token: "", shouldStripHash: false };
  }
  const params = new URLSearchParams(args.search.startsWith("?") ? args.search.slice(1) : args.search);
  const orderId = String(params.get("order_id") || "").trim();
  if (!orderId) return { orderId: "", token: "", shouldStripHash: false };
  const token = parseAccessFragment(args.hash);
  return { orderId, token, shouldStripHash: Boolean(token) };
}

export function stripResultSecretsFromUrl(href: string): { pathname: string; search: string } {
  const url = new URL(href, "https://www.thedigitalgifter.com");
  url.searchParams.delete("rc");
  url.searchParams.delete("access_token");
  url.hash = "";
  return { pathname: url.pathname, search: url.search };
}

export function analyticsLocation(origin: string, pathname: string): string {
  return `${origin}${pathname}`;
}

export async function captureOrderAccessFromUrl(args?: {
  href?: string;
  replaceState?: (url: string) => void;
  redeem?: (orderId: string, code: string) => Promise<string | null>;
}): Promise<{ orderId: string; token: string; stripped: boolean; redeemPending: boolean }> {
  const href = args?.href || (typeof window === "undefined" ? "" : window.location.href);
  if (!href) return { orderId: "", token: "", stripped: false, redeemPending: false };

  const url = new URL(href, typeof window === "undefined" ? "https://www.thedigitalgifter.com" : window.location.origin);
  if (!shouldCaptureOrderAccess(href)) {
    return { orderId: "", token: "", stripped: false, redeemPending: false };
  }

  const orderId = String(url.searchParams.get("order_id") || "").trim();
  const redeemCode = String(url.searchParams.get("rc") || "").trim() || readOrderRedeemCode(orderId);
  const queryToken = String(url.searchParams.get("access_token") || "").trim();
  const fragmentToken = parseAccessFragment(url.hash);
  let token = fragmentToken || queryToken;

  if (orderId && token) {
    storeOrderAccessToken(orderId, token);
  }
  if (orderId && redeemCode) {
    storeOrderRedeemCode(orderId, redeemCode);
  }

  let redeemPending = Boolean(orderId && redeemCode);
  if (orderId && redeemCode && args?.redeem) {
    try {
      const redeemed = await args.redeem(orderId, redeemCode);
      if (redeemed) {
        token = redeemed;
        storeOrderAccessToken(orderId, redeemed);
        clearOrderRedeemCode(orderId);
        redeemPending = false;
      }
    } catch {
      redeemPending = true;
    }
  }

  const cleaned = stripResultSecretsFromUrl(href);
  const next = `${cleaned.pathname}${cleaned.search}`;
  const hadSecrets = Boolean(fragmentToken || url.searchParams.get("rc") || queryToken);
  if (hadSecrets) {
    const replace = args?.replaceState || ((value: string) => {
      if (typeof window !== "undefined") window.history.replaceState({}, "", value);
    });
    replace(next);
  }

  return {
    orderId,
    token: token || (orderId ? readOrderAccessToken(orderId) : ""),
    stripped: hadSecrets,
    redeemPending,
  };
}
