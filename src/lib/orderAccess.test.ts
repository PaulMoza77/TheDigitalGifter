import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyticsLocation,
  captureOrderAccessFromUrl,
  orderAccessStorageKey,
  parseAccessFragment,
  stripSecretsFromUrl,
} from "./orderAccess.ts";

describe("order access capture", () => {
  it("reads the fragment token and never leaves secrets in the query", async () => {
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

    let replaced = "";
    const captured = await captureOrderAccessFromUrl({
      href: "https://www.thedigitalgifter.com/funnel/result?order_id=ord-1&rc=one-time#t=hmac-token",
      replaceState: (url) => {
        replaced = url;
      },
      redeem: async () => "redeemed-hmac",
    });
    assert.equal(captured.orderId, "ord-1");
    assert.equal(captured.token, "redeemed-hmac");
    assert.equal(store.get(orderAccessStorageKey("ord-1")), "redeemed-hmac");
    assert.equal(replaced.includes("rc="), false);
    assert.equal(replaced.includes("access_token"), false);
    assert.equal(parseAccessFragment("#t=hmac-token"), "hmac-token");
    const stripped = stripSecretsFromUrl(
      "https://www.thedigitalgifter.com/funnel/result?order_id=ord-1&access_token=leak&rc=x#t=y",
    );
    assert.equal(stripped.search.includes("access_token"), false);
    assert.equal(stripped.search.includes("rc="), false);
    assert.equal(analyticsLocation("https://www.thedigitalgifter.com", "/funnel/result"), "https://www.thedigitalgifter.com/funnel/result");
  });
});
