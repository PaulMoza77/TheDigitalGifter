import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPreviewStripeTestCheckoutEnabled,
  isStagingCheckoutEnabledOnServer,
  isStripeTestSecret,
} from "./checkoutGate.ts";

describe("preview Stripe test checkout gate", () => {
  it("stays off in production even if preview flags are set", () => {
    assert.equal(
      isPreviewStripeTestCheckoutEnabled({
        vercelEnv: "production",
        checkoutEnabled: "true",
        stripeTestMode: "true",
      }),
      false,
    );
  });

  it("enables only on non-production with both staging flags", () => {
    assert.equal(
      isPreviewStripeTestCheckoutEnabled({
        vercelEnv: "preview",
        checkoutEnabled: "true",
        stripeTestMode: "true",
      }),
      true,
    );
    assert.equal(
      isPreviewStripeTestCheckoutEnabled({
        vercelEnv: "preview",
        checkoutEnabled: "true",
        stripeTestMode: "false",
      }),
      false,
    );
    assert.equal(
      isPreviewStripeTestCheckoutEnabled({
        vercelEnv: "preview",
        checkoutEnabled: "",
        stripeTestMode: "true",
      }),
      false,
    );
  });
});

describe("server staging checkout gate", () => {
  it("requires test Stripe keys and an explicit staging allow flag", () => {
    assert.equal(isStripeTestSecret("sk_test_123"), true);
    assert.equal(isStripeTestSecret("sk_live_123"), false);
    assert.equal(
      isStagingCheckoutEnabledOnServer({
        checkoutEnabled: "true",
        allowStagingCheckout: "true",
        stripeSecretKey: "sk_test_abc",
      }),
      true,
    );
    assert.equal(
      isStagingCheckoutEnabledOnServer({
        checkoutEnabled: "true",
        allowStagingCheckout: "true",
        stripeSecretKey: "sk_live_abc",
      }),
      false,
    );
    assert.equal(
      isStagingCheckoutEnabledOnServer({
        checkoutEnabled: "true",
        allowStagingCheckout: "",
        stripeSecretKey: "sk_test_abc",
      }),
      false,
    );
  });
});
