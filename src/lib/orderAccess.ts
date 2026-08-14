const ORDER_KEY_PREFIX = "tdg.orderAccess.";

export function orderAccessStorageKey(orderId: string): string {
  return `${ORDER_KEY_PREFIX}${orderId}`;
}

export function readOrderAccessToken(orderId: string): string {
  if (typeof sessionStorage === "undefined" || !orderId) return "";
  return String(sessionStorage.getItem(orderAccessStorageKey(orderId)) || "").trim();
}

export function storeOrderAccessToken(orderId: string, token: string): void {
  if (typeof sessionStorage === "undefined" || !orderId || !token) return;
  sessionStorage.setItem(orderAccessStorageKey(orderId), token);
}

export function parseAccessFragment(hash: string): string {
  const raw = String(hash || "").replace(/^#/, "");
  if (!raw) return "";
  if (raw.startsWith("t=")) {
    return decodeURIComponent(raw.slice(2));
  }
  const params = new URLSearchParams(raw);
  return String(params.get("t") || params.get("access_token") || "").trim();
}

export function stripSecretsFromUrl(href: string): { pathname: string; search: string } {
  const url = new URL(href, "https://www.thedigitalgifter.com");
  url.searchParams.delete("access_token");
  url.searchParams.delete("rc");
  url.searchParams.delete("code");
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
}): Promise<{ orderId: string; token: string; stripped: boolean }> {
  const href = args?.href || (typeof window === "undefined" ? "" : window.location.href);
  if (!href) return { orderId: "", token: "", stripped: false };

  const url = new URL(href, typeof window === "undefined" ? "https://www.thedigitalgifter.com" : window.location.origin);
  const orderId = String(url.searchParams.get("order_id") || "").trim();
  const redeemCode = String(url.searchParams.get("rc") || url.searchParams.get("code") || "").trim();
  const queryToken = String(url.searchParams.get("access_token") || "").trim();
  const fragmentToken = parseAccessFragment(url.hash);
  let token = fragmentToken || queryToken;

  if (orderId && token) {
    storeOrderAccessToken(orderId, token);
  }

  if (orderId && redeemCode && args?.redeem) {
    const redeemed = await args.redeem(orderId, redeemCode);
    if (redeemed) {
      token = redeemed;
      storeOrderAccessToken(orderId, redeemed);
    }
  }

  const cleaned = stripSecretsFromUrl(href);
  const next = `${cleaned.pathname}${cleaned.search}`;
  const currentPath = typeof window === "undefined"
    ? `${url.pathname}${url.search}`
    : `${window.location.pathname}${window.location.search}`;
  const hadSecrets = Boolean(fragmentToken || redeemCode || queryToken);
  if (hadSecrets) {
    const replace = args?.replaceState || ((value: string) => {
      if (typeof window !== "undefined") window.history.replaceState({}, "", value);
    });
    replace(next);
  }

  return { orderId, token: token || (orderId ? readOrderAccessToken(orderId) : ""), stripped: hadSecrets || currentPath !== next };
}
