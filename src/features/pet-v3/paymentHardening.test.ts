import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPetOrderReturnUrl,
  isTokenlessPetOrderReturnUrl,
  PET_ORDER_RETURN_SESSION_PLACEHOLDER,
} from "../pet/orderReturnUrl";
import {
  clearCachedV3EmbeddedCheckout,
  isValidCachedV3EmbeddedCheckout,
  readCachedV3EmbeddedCheckout,
  readRecoverableV3CheckoutOrder,
  writeCachedV3EmbeddedCheckout,
  V3_CHECKOUT_SESSION_CACHE_KEY,
} from "./v3CheckoutHold";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const V3_CHECKOUT_EXPIRED_MESSAGE =
  "Your secure checkout session expired. Please upload your cat photo again.";

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

function installMemoryStorage() {
  const local = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => local.get(key) ?? null,
        setItem: (key: string, value: string) => {
          local.set(key, value);
        },
        removeItem: (key: string) => {
          local.delete(key);
        },
      },
      location: { origin: "https://www.thedigitalgifter.com" },
    },
  });
  return local;
}

describe("Cat V3 + return URL payment hardening", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it("builds canonical V1/V3 post-payment URLs with token and session_id placeholder", () => {
    const token = "ord_token_abc+/=xyz";
    const url = buildPetOrderReturnUrl(token, "https://www.thedigitalgifter.com");
    expect(url).toBe(
      `https://www.thedigitalgifter.com/pet/order?token=${encodeURIComponent(token)}&session_id=${PET_ORDER_RETURN_SESSION_PLACEHOLDER}`,
    );
    expect(url).toContain(PET_ORDER_RETURN_SESSION_PLACEHOLDER);
    expect(isTokenlessPetOrderReturnUrl(url)).toBe(false);
    expect(isTokenlessPetOrderReturnUrl("https://www.thedigitalgifter.com/pet/order")).toBe(true);
    expect(isTokenlessPetOrderReturnUrl(`${window.location.origin}/pet/order`)).toBe(true);
  });

  it("server Session return_url is SoT; V1/V3 confirm() never passes client returnUrl", () => {
    const v1 = readSrc("src/features/pet/PetCheckoutPage.tsx");
    const v3 = readSrc("src/features/pet-v3/screens/OfferScreen.tsx");
    const shared = readSrc("src/features/pet/components/CustomStripeCheckout.tsx");
    const edge = readSrc("supabase/functions/pet-funnel/index.ts");

    expect(edge).toContain(
      '/pet/order?token=${encodeURIComponent(publicToken)}&session_id={CHECKOUT_SESSION_ID}',
    );
    expect(edge).toContain('params.set("return_url", successUrl)');
    expect(shared).toContain("Server Session return_url is the only source of truth");
    expect(shared).toContain("expressCheckoutConfirmEvent ? { expressCheckoutConfirmEvent } : {}");
    expect(shared).not.toContain("returnUrl:");
    expect(shared).not.toMatch(/confirm\(\s*\{[^}]*returnUrl/);
    expect(shared).not.toContain("Basil Custom Checkout requires returnUrl");
    expect(v1).not.toContain("returnUrl=");
    expect(v1).not.toContain("buildPetOrderReturnUrl");
    expect(v3).not.toContain("returnUrl=");
    expect(v3).not.toContain("buildPetOrderReturnUrl");
    expect(isTokenlessPetOrderReturnUrl("https://www.thedigitalgifter.com/pet/order")).toBe(true);
  });

  it("tokenless client URL cannot override the server Session return_url", () => {
    const shared = readSrc("src/features/pet/components/CustomStripeCheckout.tsx");
    expect(shared).not.toContain("/pet/order");
    expect(shared).not.toMatch(/\breturnUrl\s*:/);
    expect(shared).not.toMatch(/returnUrl\s*=/);
    expect(shared).not.toMatch(/confirm\(\s*\{[\s\S]*?returnUrl/);
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain("return_url");
  });

  it("V2 checkout is isolated on Elements (not V1 Custom)", () => {
    const v2 = readSrc("src/features/pet-v2/PetV2FunnelPage.tsx");
    expect(v2).toContain("useV2EmbeddedCheckout");
    expect(v2).not.toContain("CustomStripeCheckout");
    expect(v2).toContain("buildV2PersonalizedTeaser");
  });

  it("V3 refresh with valid checkout restores without new order/upload/preview", () => {
    const now = 2_000_000;
    writeCachedV3EmbeddedCheckout({
      orderId: "order-refresh-valid",
      publicToken: "token-refresh-valid",
      sessionId: "cs_test_refresh_valid",
      clientSecret: "cs_test_refresh_valid_secret_abc",
      publishableKey: "pk_test_51refresh0000000000",
      expiresAt: now + 120_000,
    });
    const cached = readCachedV3EmbeddedCheckout(now);
    expect(cached?.orderId).toBe("order-refresh-valid");
    expect(isValidCachedV3EmbeddedCheckout(cached!)).toBe(true);

    const hook = readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts");
    expect(hook).toContain("readCachedV3EmbeddedCheckout()");
    expect(hook).toContain("hydrateFromCache");
    expect(hook).toContain("valid Elements checkout — restore without photo File");
    expect(hook).not.toMatch(/localStorage.*photo|photo.*localStorage/i);
  });

  it("V3 refresh with invalid checkout recovers the same unpaid order", () => {
    const now = 3_000_000;
    const local = installMemoryStorage();
    local.set(
      V3_CHECKOUT_SESSION_CACHE_KEY,
      JSON.stringify({
        orderId: "order-refresh-invalid",
        publicToken: "token-refresh-invalid",
        sessionId: "cs_live_stale",
        clientSecret: "cs_live_stale",
        publishableKey: "pk_live_mismatch",
        expiresAt: now + 120_000,
      }),
    );
    expect(readCachedV3EmbeddedCheckout(now)).toBeNull();
    const recoverable = readRecoverableV3CheckoutOrder(now);
    expect(recoverable).toEqual({
      orderId: "order-refresh-invalid",
      publicToken: "token-refresh-invalid",
      sessionId: "cs_live_stale",
      expiresAt: now + 120_000,
    });

    const hook = readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts");
    expect(hook).toContain("readRecoverableV3CheckoutOrder");
    expect(hook).toContain("recoverExistingOrderCheckout");
    expect(hook).toContain("recover same unpaid order with one Elements Session");
  });

  it("refresh never consumes another preview and never stores raw photo in localStorage", () => {
    const hold = readSrc("src/features/pet-v3/v3CheckoutHold.ts");
    const storage = readSrc("src/features/pet-v3/storage.ts");
    expect(hold).toContain("Never stores raw photo bytes");
    expect(hold).not.toContain("photoPreviewDataUrl");
    expect(storage).toContain("sessionStorage");
    expect(storage).toContain("inMemoryFile");
    expect(readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts")).not.toContain("requestV3Preview");
    expect(readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts")).not.toContain("remainingSessionPreviews");
  });

  it("one Retry / hosted fallback recovers the same order and disables while processing", () => {
    const offer = readSrc("src/features/pet-v3/screens/OfferScreen.tsx");
    const hook = readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts");
    const elements = readSrc("src/features/pet-v3/components/V3ElementsCheckout.tsx");

    expect(offer).toContain("onClick={checkout.retry}");
    expect(offer).toContain("disabled={checkout.loading}");
    expect(offer).toContain("Continue to secure Stripe checkout");
    expect(offer).toContain("onInitError={() => {");
    expect(offer).toContain("checkout.invalidateStripeSession()");
    expect(hook).toContain("if (bootstrapInFlight.current || loading) return");
    expect(hook).toContain("if (orderRef.current)");
    expect(hook).toContain("startHostedFallback");
    expect(elements).toContain('from "@stripe/stripe-js"');
    expect(elements).toContain("loadStripe");
    expect(elements).not.toContain('from "../../pet/stripeLoader"');
  });

  it("never shows an empty payment container when checkout is unrecoverable", () => {
    const offer = readSrc("src/features/pet-v3/screens/OfferScreen.tsx");
    const hook = readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts");
    expect(hook).toContain("V3_CHECKOUT_EXPIRED_MESSAGE");
    expect(V3_CHECKOUT_EXPIRED_MESSAGE).toContain("upload your cat photo again");
    expect(offer).toContain("Upload your cat photo again");
    expect(offer).toContain("showExpired");
    expect(offer).toContain("Preparing secure payment");
    expect(offer).not.toMatch(/checkoutReady[\s\S]{0,40}\?\s*null/);
  });

  it("Apple Pay / Express onReady does not begin checkout", () => {
    const shared = readSrc("src/features/pet/components/CustomStripeCheckout.tsx");
    const offer = readSrc("src/features/pet-v3/screens/OfferScreen.tsx");
    expect(shared).toContain("Wallet availability is not Begin Checkout");
    expect(shared).toMatch(/onReady=\{\(event\) => \{[\s\S]*?setApplePayFromStripe/);
    expect(shared).not.toMatch(/onReady=\{\(event\) => \{[\s\S]*?markInteraction\(\)/);
    expect(shared).toContain("onClick={markInteraction}");
    expect(offer).toContain("onReady={markCheckoutViewed}");
    expect(offer).toContain("onPaymentInteraction={markBeginCheckout}");
  });

  it("placeholder pending+ checkout emails never reach Meta CAPI", () => {
    const meta = readSrc("supabase/functions/_shared/pet/meta.ts");
    const v3Ic = readSrc("supabase/functions/_shared/pet/v3InitiateCheckout.ts");
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(meta).toContain("isCheckoutPlaceholderEmail");
    expect(meta).toContain("hashCustomerEmailForMeta");
    expect(meta).toMatch(/pending\\\+/);
    expect(meta).toMatch(/checkout\\.thedigitalgifter\\.com/);
    expect(v3Ic).toContain("isCheckoutPlaceholderEmail");
    expect(funnel).toContain("isCheckoutPlaceholderEmail(asString(order.email)) ? null");
    expect(funnel).toContain("isCheckoutPlaceholderEmail(email)");
  });

  it("order page validates token + Stripe session relationship server-side", () => {
    const routes = readSrc("src/features/pet/PetRoutes.tsx");
    const page = readSrc("src/features/pet/PetOrderPage.tsx");
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(routes).toContain('params.get("session_id")');
    expect(page).toContain("checkoutSessionId");
    expect(funnel).toContain("checkoutSessionId || body.sessionId");
    expect(funnel).toContain("!orderSessionId || orderSessionId !== checkoutSessionId");
    expect(funnel).toContain("Strict relation");
  });

  it("V1 cache reuse requires publicToken; legacy partial cache is invalidated", () => {
    const v1 = readSrc("src/features/pet/PetCheckoutPage.tsx");
    const hold = readSrc("src/features/pet/checkoutHold.ts");
    expect(hold).toContain("isValidCachedEmbeddedCheckout");
    expect(hold).toContain("clearCachedEmbeddedCheckout");
    expect(v1).toContain("isValidCachedEmbeddedCheckout(cached)");
    expect(v1).toContain("clearCachedEmbeddedCheckout()");
    expect(v1).toContain("Legacy/partial cache");
    expect(v1).not.toContain("cached.publicToken || null");
  });

  it("browser success alone cannot mark paid; webhook remains payment source of truth", () => {
    const page = readSrc("src/features/pet/PetOrderPage.tsx");
    const fulfill = readSrc("supabase/functions/_shared/pet/stripeFulfill.ts");
    expect(page).not.toContain('status: "paid"');
    expect(page).not.toContain("markPaid");
    expect(page).not.toContain("fulfill_pet_order_payment");
    expect(fulfill).toContain("fulfill_pet_order_payment");
    expect(fulfill).toContain('email: order.email');
  });

  it("contact update blocks payment when internal update fails; Stripe sync failure is non-blocking", () => {
    const hook = readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts");
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(hook).toContain("Could not save your details. Try again.");
    expect(hook).toContain("fulfillmentUsesInternalEmail: true");
    expect(funnel).toContain("contactUpdateError");
    expect(funnel).toContain("internal delivery email preserved");
    expect(funnel).toContain("stripeSessionSynced");
  });

  it("clears recoverable cache helper without wiping identity on invalid secret read", () => {
    const now = 4_000_000;
    writeCachedV3EmbeddedCheckout({
      orderId: "order-keep",
      publicToken: "token-keep",
      sessionId: "cs_test_keep",
      clientSecret: "cs_test_keep_secret_x",
      publishableKey: "pk_test_51keep0000000000000",
      expiresAt: now + 60_000,
    });
    expect(readCachedV3EmbeddedCheckout(now)?.orderId).toBe("order-keep");
    clearCachedV3EmbeddedCheckout();
    expect(readRecoverableV3CheckoutOrder(now)).toBeNull();
  });
});
