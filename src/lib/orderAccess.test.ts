import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  analyticsLocation,
  captureOrderAccessFromUrl,
  captureResultHashToken,
  clearOrderRedeemCode,
  isAuthCallbackPath,
  orderAccessStorageKey,
  orderRedeemStorageKey,
  parseAccessFragment,
  readOrderRedeemCode,
  shouldCaptureOrderAccess,
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
      redeem: async () => null,
    });
    assert.equal(failed.redeemPending, true);
    assert.equal(readOrderRedeemCode("ord-1"), "one-time");

    const refreshed = await captureOrderAccessFromUrl({
      href: "https://www.thedigitalgifter.com/funnel/result?order_id=ord-1",
      redeem: async (_orderId, code) => (code === "one-time" ? "hmac-from-retry" : null),
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
        return "tok-a";
      },
    });
    const second = await captureOrderAccessFromUrl({
      href,
      redeem: async () => {
        redeemCalls += 1;
        return "tok-a";
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
});
