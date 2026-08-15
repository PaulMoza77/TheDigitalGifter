import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  abortAfter,
  analyticsLocation,
  applyRedeemOutcome,
  captureOrderAccessFromUrl,
  captureResultHashToken,
  classifyRedeemHttp,
  clearOrderRedeemCode,
  isAuthCallbackPath,
  orderAccessStorageKey,
  orderRedeemStorageKey,
  parseAccessFragment,
  readOrderRedeemCode,
  REDEEM_BOOTSTRAP_TIMEOUT_MS,
  redeemResultAccessRequest,
  resetRedeemBootstrapState,
  retryRedeemWithBackoff,
  shouldCaptureOrderAccess,
  shouldFetchSignedResult,
  storeOrderRedeemCode,
  stripResultSecretsFromUrl,
} from "./orderAccess.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function mockSessionStorage() {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  Object.defineProperty(globalThis, "sessionStorage", { value: sessionStorage, configurable: true });
  resetRedeemBootstrapState();
  return store;
}

describe("order access capture", () => {
  it("captures /funnel/result#t= only when order_id is present", async () => {
    const store = mockSessionStorage();
    let replaced = "";
    const captured = await captureOrderAccessFromUrl({
      href: "https://www.thedigitalgifter.com/funnel/result?order_id=ord-1#t=hmac-token",
      replaceState: (url) => {
        replaced = url;
      },
    });
    assert.equal(captured.orderId, "ord-1");
    assert.equal(captured.token, "hmac-token");
    assert.equal(store.get(orderAccessStorageKey("ord-1")), "hmac-token");
    assert.equal(replaced.includes("#t="), false);
    assert.equal(parseAccessFragment("#t=hmac-token"), "hmac-token");
    const hashOnly = captureResultHashToken({
      pathname: "/funnel/result",
      search: "?order_id=ord-1",
      hash: "#t=hmac-token",
    });
    assert.equal(hashOnly.shouldStripHash, true);
    assert.equal(
      captureResultHashToken({ pathname: "/funnel/result", search: "", hash: "#t=hmac-token" }).shouldStripHash,
      false,
    );
  });

  it("never strips PKCE ?code= or implicit auth hashes on /auth/callback", async () => {
    mockSessionStorage();
    let replaced = "unchanged";
    const pkce = await captureOrderAccessFromUrl({
      href: "https://www.thedigitalgifter.com/auth/callback?code=pkce-oauth-code",
      replaceState: (url) => {
        replaced = url;
      },
    });
    assert.equal(pkce.stripped, false);
    assert.equal(replaced, "unchanged");
    assert.equal(shouldCaptureOrderAccess("https://www.thedigitalgifter.com/auth/callback?code=pkce-oauth-code"), false);
    assert.equal(isAuthCallbackPath("/auth/callback"), true);

    const implicit = await captureOrderAccessFromUrl({
      href: "https://www.thedigitalgifter.com/auth/callback#access_token=tok&refresh_token=ref&error=access_denied",
      replaceState: (url) => {
        replaced = url;
      },
    });
    assert.equal(implicit.stripped, false);
    assert.equal(replaced, "unchanged");
    assert.equal(shouldCaptureOrderAccess("https://www.thedigitalgifter.com/pricing#pricing"), false);
  });

  it("does not treat OAuth code as a redeem code and keeps rc in sessionStorage before stripping", async () => {
    const store = mockSessionStorage();
    let replaced = "";
    const captured = await captureOrderAccessFromUrl({
      href: "https://www.thedigitalgifter.com/funnel/result?order_id=ord-1&rc=one-time&code=pkce#t=hmac-token",
      replaceState: (url) => {
        replaced = url;
      },
      redeem: async () => {
        throw new Error("network");
      },
    });
    assert.equal(captured.redeemPending, true);
    assert.equal(store.get(orderRedeemStorageKey("ord-1")), "one-time");
    assert.equal(replaced.includes("rc="), false);
    assert.equal(replaced.includes("code=pkce"), true);
    const stripped = stripResultSecretsFromUrl(
      "https://www.thedigitalgifter.com/funnel/result?order_id=ord-1&access_token=leak&rc=x&code=pkce#t=y",
    );
    assert.equal(stripped.search.includes("access_token"), false);
    assert.equal(stripped.search.includes("rc="), false);
    assert.equal(stripped.search.includes("code=pkce"), true);
    assert.equal(analyticsLocation("https://www.thedigitalgifter.com", "/funnel/result"), "https://www.thedigitalgifter.com/funnel/result");
  });

  it("retries a stored rc after a lost response and clears it only after success", async () => {
    const store = mockSessionStorage();
    storeOrderRedeemCode("ord-1", "one-time");
    const failed = await captureOrderAccessFromUrl({
      href: "https://www.thedigitalgifter.com/funnel/result?order_id=ord-1",
      redeem: async () => ({ status: "transient", error: "timeout" }),
    });
    assert.equal(failed.redeemPending, true);
    assert.equal(failed.redeemStatus, "transient");
    assert.equal(readOrderRedeemCode("ord-1"), "one-time");

    const refreshed = await captureOrderAccessFromUrl({
      href: "https://www.thedigitalgifter.com/funnel/result?order_id=ord-1",
      redeem: async (_orderId, code) => (
        code === "one-time" ? { status: "ok", token: "hmac-from-retry" } : { status: "invalid" }
      ),
    });
    assert.equal(refreshed.token, "hmac-from-retry");
    assert.equal(refreshed.redeemPending, false);
    assert.equal(store.get(orderAccessStorageKey("ord-1")), "hmac-from-retry");
    assert.equal(readOrderRedeemCode("ord-1"), "");

    storeOrderRedeemCode("ord-2", "same-rc");
    let redeemCalls = 0;
    const href = "https://www.thedigitalgifter.com/funnel/result?order_id=ord-2&rc=same-rc";
    const first = await captureOrderAccessFromUrl({
      href,
      redeem: async () => {
        redeemCalls += 1;
        return { status: "ok", token: "tok-a" };
      },
    });
    const second = await captureOrderAccessFromUrl({
      href,
      redeem: async () => {
        redeemCalls += 1;
        return { status: "ok", token: "tok-a" };
      },
    });
    assert.equal(first.token, "tok-a");
    assert.equal(second.token, "tok-a");
    assert.equal(second.redeemPending, false);
    assert.equal(redeemCalls, 2);
    clearOrderRedeemCode("ord-2");
  });

  it("limits the index.html boot script to result pages with #t= tokens", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    assert.match(html, /pathname !== "\/funnel\/result"/);
    assert.match(html, /params\.get\("order_id"\)/);
    assert.match(html, /#t=/);
    assert.equal(html.includes("history.replaceState({}, \"\", location.pathname + location.search);"), true);
    assert.equal(/if\s*\(\s*!token\s*\)\s*return/.test(html), true);
  });

  it("times out bootstrap redeem so the app can still render", async () => {
    const { signal, cancel } = abortAfter(20);
    await new Promise<void>((resolve) => {
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
    cancel();
    assert.equal(signal.aborted, true);
    assert.equal(REDEEM_BOOTSTRAP_TIMEOUT_MS, 8000);

    const boot = readFileSync(join(root, "src/main.tsx"), "utf8");
    const access = readFileSync(join(root, "src/lib/orderAccess.ts"), "utf8");
    assert.equal(boot.includes("redeemResultAccessRequest"), true);
    assert.equal(boot.includes("await captureOrderAccessFromUrl"), true);
    assert.equal(access.includes("abortAfter(args.timeoutMs ?? REDEEM_BOOTSTRAP_TIMEOUT_MS)"), true);
    assert.equal(access.includes("signal: timeout.signal"), true);
  });

  it("recovers from a redeem timeout and does not fetch the signed result until bootstrap is final", async () => {
    mockSessionStorage();
    storeOrderRedeemCode("ord-timeout", "keep-me");
    const timedOut = await captureOrderAccessFromUrl({
      href: "https://www.thedigitalgifter.com/funnel/result?order_id=ord-timeout",
      redeem: async () => ({ status: "transient", error: "timeout" }),
    });
    assert.equal(timedOut.redeemStatus, "transient");
    assert.equal(timedOut.redeemPending, true);
    assert.equal(readOrderRedeemCode("ord-timeout"), "keep-me");
    assert.equal(shouldFetchSignedResult({
      redeemPending: timedOut.redeemPending,
      bootstrapStatus: timedOut.redeemStatus,
    }), false);

    const sleeps: number[] = [];
    let attempts = 0;
    const recovered = await retryRedeemWithBackoff({
      delaysMs: [1, 2],
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      redeem: async () => {
        attempts += 1;
        if (attempts < 3) return { status: "transient", error: "timeout" };
        return { status: "ok", token: "hmac-after-timeout" };
      },
    });
    const applied = applyRedeemOutcome("ord-timeout", recovered);
    assert.equal(recovered.status, "ok");
    assert.equal(applied.status, "ok");
    assert.equal(applied.redeemPending, false);
    assert.equal(readOrderRedeemCode("ord-timeout"), "");
    assert.deepEqual(sleeps, [1, 2]);
    assert.equal(shouldFetchSignedResult({
      redeemPending: applied.redeemPending,
      bootstrapStatus: applied.status,
    }), true);
  });

  it("clears an invalid redeem code and never treats it as unauthorized-until-refresh", async () => {
    mockSessionStorage();
    storeOrderRedeemCode("ord-bad", "bad-code");
    const invalid = await captureOrderAccessFromUrl({
      href: "https://www.thedigitalgifter.com/funnel/result?order_id=ord-bad",
      redeem: async () => ({ status: "invalid" }),
    });
    assert.equal(invalid.redeemStatus, "invalid");
    assert.equal(invalid.redeemPending, false);
    assert.equal(readOrderRedeemCode("ord-bad"), "");
    assert.equal(shouldFetchSignedResult({
      redeemPending: invalid.redeemPending,
      bootstrapStatus: invalid.redeemStatus,
    }), false);
    assert.equal(classifyRedeemHttp({ ok: false, status: 401, kind: "invalid" }).status, "invalid");
    assert.equal(classifyRedeemHttp({ ok: false, status: 410, kind: "expired" }).status, "expired");
    assert.equal(classifyRedeemHttp({ aborted: true }).status, "transient");
    assert.equal(classifyRedeemHttp({ ok: false, status: 500 }).status, "transient");

    const outcome = await redeemResultAccessRequest({
      url: "https://example.test",
      anon: "anon",
      orderId: "ord-bad",
      code: "bad-code",
      fetchImpl: async () => new Response(JSON.stringify({ kind: "invalid" }), { status: 401 }),
    });
    assert.equal(outcome.status, "invalid");
  });
});
