import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  checkoutRequestStorageKey,
  readCheckoutRequestId,
  readOrCreateCheckoutRequestId,
  storeCheckoutRequestId,
} from "./checkoutRequest.ts";

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

describe("checkout request identity", () => {
  it("reuses the same checkout_request_id after a lost response", () => {
    const store = mockSessionStorage();
    const first = readOrCreateCheckoutRequestId("upload-1", () => "11111111-1111-4111-8111-111111111111");
    const retry = readOrCreateCheckoutRequestId("upload-1", () => "22222222-2222-4222-8222-222222222222");
    assert.equal(first, "11111111-1111-4111-8111-111111111111");
    assert.equal(retry, first);
    assert.equal(readCheckoutRequestId("upload-1"), first);
    assert.equal(store.get(checkoutRequestStorageKey("upload-1")), first);
    const payment = readFileSync(join(root, "src/components/funnelVersion/FunnelPayment.tsx"), "utf8");
    assert.equal(payment.includes("checkout_request_id: checkoutRequestId"), true);
    assert.equal(payment.includes("readOrCreateCheckoutRequestId"), true);
    storeCheckoutRequestId("upload-2", "33333333-3333-4333-8333-333333333333");
    assert.equal(readOrCreateCheckoutRequestId("upload-2", () => "other"), "33333333-3333-4333-8333-333333333333");
  });
});
