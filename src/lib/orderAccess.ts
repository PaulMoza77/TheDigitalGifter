const ORDER_KEY_PREFIX = "tdg.orderAccess.";
const REDEEM_KEY_PREFIX = "tdg.orderRedeem.";
const RESULT_PATH = "/funnel/result";
const AUTH_CALLBACK_PATH = "/auth/callback";
export const REDEEM_BOOTSTRAP_TIMEOUT_MS = 8000;
export const REDEEM_RETRY_BACKOFF_MS = [1000, 2000, 4000] as const;

export type RedeemOutcome =
  | { status: "ok"; token: string }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "transient"; error?: string };

export type RedeemBootstrapStatus = "idle" | "pending" | "ok" | "invalid" | "expired" | "transient";

export type RedeemBootstrapState = {
  orderId: string;
  status: RedeemBootstrapStatus;
  token: string;
  redeemPending: boolean;
};

let redeemBootstrap: RedeemBootstrapState = {
  orderId: "",
  status: "idle",
  token: "",
  redeemPending: false,
};

export function getRedeemBootstrapState(): RedeemBootstrapState {
  return { ...redeemBootstrap };
}

export function setRedeemBootstrapState(next: RedeemBootstrapState): RedeemBootstrapState {
  redeemBootstrap = { ...next };
  return getRedeemBootstrapState();
}

export function resetRedeemBootstrapState(): RedeemBootstrapState {
  return setRedeemBootstrapState({
    orderId: "",
    status: "idle",
    token: "",
    redeemPending: false,
  });
}

export function shouldClearRedeemCode(outcome: RedeemOutcome): boolean {
  return outcome.status === "ok" || outcome.status === "invalid" || outcome.status === "expired";
}

export function shouldFetchSignedResult(args: {
  redeemPending?: boolean;
  bootstrapStatus: RedeemBootstrapStatus;
}): boolean {
  if (args.redeemPending) return false;
  return args.bootstrapStatus === "idle" || args.bootstrapStatus === "ok";
}

export function classifyRedeemHttp(args: {
  ok?: boolean;
  status?: number;
  kind?: string;
  accessToken?: string;
  aborted?: boolean;
  networkError?: boolean;
}): RedeemOutcome {
  if (args.aborted || args.networkError) {
    return { status: "transient", error: args.aborted ? "timeout" : "network" };
  }
  const token = String(args.accessToken || "").trim();
  if (args.ok && token) return { status: "ok", token };
  const kind = String(args.kind || "").trim();
  if (kind === "expired" || args.status === 410) return { status: "expired" };
  if (kind === "invalid" || kind === "mismatch" || args.status === 401) return { status: "invalid" };
  if ((args.status ?? 0) >= 500 || args.status === 408 || args.status === 429 || args.status === 0) {
    return { status: "transient", error: `http_${args.status || 0}` };
  }
  if ((args.status ?? 0) >= 400 && (args.status ?? 0) < 500) return { status: "invalid" };
  return { status: "transient", error: "unknown" };
}

export async function retryRedeemWithBackoff(args: {
  redeem: () => Promise<RedeemOutcome>;
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  shouldContinue?: () => boolean;
}): Promise<RedeemOutcome> {
  const delays = args.delaysMs ?? REDEEM_RETRY_BACKOFF_MS;
  const sleep = args.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let last: RedeemOutcome = { status: "transient", error: "untried" };
  for (let i = 0; i <= delays.length; i += 1) {
    if (args.shouldContinue && !args.shouldContinue()) return last;
    last = await args.redeem();
    if (last.status !== "transient") return last;
    if (i === delays.length) break;
    await sleep(delays[i]);
  }
  return last;
}

export async function redeemResultAccessRequest(args: {
  url: string;
  anon: string;
  orderId: string;
  code: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<RedeemOutcome> {
  const timeout = abortAfter(args.timeoutMs ?? REDEEM_BOOTSTRAP_TIMEOUT_MS);
  try {
    const res = await (args.fetchImpl || fetch)(`${args.url}/functions/v1/redeem-result-access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: args.anon,
        Authorization: `Bearer ${args.anon}`,
      },
      body: JSON.stringify({ order_id: args.orderId, code: args.code }),
      signal: timeout.signal,
    });
    const data = await res.json().catch(() => ({})) as { access_token?: string; kind?: string };
    return classifyRedeemHttp({
      ok: res.ok,
      status: res.status,
      kind: data.kind,
      accessToken: data.access_token,
    });
  } catch (err) {
    const aborted = typeof err === "object" && err !== null && "name" in err && (err as { name?: string }).name === "AbortError";
    return classifyRedeemHttp({ aborted, networkError: !aborted });
  } finally {
    timeout.cancel();
  }
}

export function applyRedeemOutcome(orderId: string, outcome: RedeemOutcome): RedeemBootstrapState {
  if (outcome.status === "ok") {
    storeOrderAccessToken(orderId, outcome.token);
    clearOrderRedeemCode(orderId);
    return setRedeemBootstrapState({
      orderId,
      status: "ok",
      token: outcome.token,
      redeemPending: false,
    });
  }
  if (shouldClearRedeemCode(outcome)) {
    clearOrderRedeemCode(orderId);
    return setRedeemBootstrapState({
      orderId,
      status: outcome.status,
      token: orderId ? readOrderAccessToken(orderId) : "",
      redeemPending: false,
    });
  }
  return setRedeemBootstrapState({
    orderId,
    status: "transient",
    token: orderId ? readOrderAccessToken(orderId) : "",
    redeemPending: true,
  });
}

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
  redeem?: (orderId: string, code: string) => Promise<RedeemOutcome>;
}): Promise<{
  orderId: string;
  token: string;
  stripped: boolean;
  redeemPending: boolean;
  redeemStatus: RedeemBootstrapStatus;
}> {
  const href = args?.href || (typeof window === "undefined" ? "" : window.location.href);
  if (!href) {
    return { orderId: "", token: "", stripped: false, redeemPending: false, redeemStatus: "idle" };
  }

  const url = new URL(href, typeof window === "undefined" ? "https://www.thedigitalgifter.com" : window.location.origin);
  if (!shouldCaptureOrderAccess(href)) {
    return { orderId: "", token: "", stripped: false, redeemPending: false, redeemStatus: "idle" };
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
  let redeemStatus: RedeemBootstrapStatus = redeemPending ? "pending" : "idle";
  if (orderId && redeemCode && args?.redeem) {
    try {
      const outcome = await args.redeem(orderId, redeemCode);
      const applied = applyRedeemOutcome(orderId, outcome);
      if (outcome.status === "ok") token = outcome.token;
      redeemPending = applied.redeemPending;
      redeemStatus = applied.status;
    } catch {
      redeemPending = true;
      redeemStatus = "transient";
      setRedeemBootstrapState({
        orderId,
        status: "transient",
        token: token || (orderId ? readOrderAccessToken(orderId) : ""),
        redeemPending: true,
      });
    }
  } else if (orderId) {
    setRedeemBootstrapState({
      orderId,
      status: redeemStatus,
      token: token || readOrderAccessToken(orderId),
      redeemPending,
    });
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
    redeemStatus,
  };
}
