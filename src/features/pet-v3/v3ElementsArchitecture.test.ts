import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  normalizeCheckoutUiMode,
  isOnPageCheckoutUi,
  sessionMatchesRequestedUiMode,
} from "../pet/funnelGuards";
import {
  clearCachedV3EmbeddedCheckout,
  isValidCachedV3EmbeddedCheckout,
  readCachedV3EmbeddedCheckout,
  readRecoverableV3CheckoutOrder,
  writeCachedV3EmbeddedCheckout,
  V3_CHECKOUT_CACHE_VERSION,
  V3_CHECKOUT_MODE_ELEMENTS,
  V3_CHECKOUT_SESSION_CACHE_KEY,
  V3_CHECKOUT_SESSION_CACHE_KEY_LEGACY,
} from "./v3CheckoutHold";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

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

describe("Cat V3 Minutes Guides Elements architecture", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it("V3 requests uiMode elements", () => {
    const hook = readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts");
    expect(hook).toContain('V3_ELEMENTS_UI_MODE = "elements"');
    expect(hook).toMatch(/uiMode:\s*V3_ELEMENTS_UI_MODE/);
    expect(hook).not.toMatch(/uiMode:\s*"custom"/);
  });

  it("server creates ui_mode elements with Dahlia API and tokenized return_url", () => {
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(funnel).toContain('params.set("ui_mode", "elements")');
    expect(funnel).toContain("2026-07-29.dahlia");
    expect(funnel).toContain("2025-03-31.basil");
    expect(funnel).toContain(
      '`${siteOrigin()}/pet/order?token=${encodeURIComponent(publicToken)}&session_id={CHECKOUT_SESSION_ID}`',
    );
    expect(funnel).toContain("normalizeCheckoutUiMode");
    expect(funnel).toContain("sessionMatchesRequestedUiMode");
  });

  it("Cat V3 uses official loadStripe and does not use the custom Dahlia loader", () => {
    const elements = readSrc("src/features/pet-v3/components/V3ElementsCheckout.tsx");
    const page = readSrc("src/features/pet-v3/PetV3FunnelPage.tsx");
    const offer = readSrc("src/features/pet-v3/screens/OfferScreen.tsx");
    expect(elements).toContain('import { loadStripe } from "@stripe/stripe-js"');
    expect(elements).toContain("CheckoutElementsProvider");
    expect(elements).toContain("PaymentElement");
    expect(elements).toContain("ExpressCheckoutElement");
    expect(elements).toContain("useCheckoutElements");
    expect(elements).not.toContain('from "../../pet/stripeLoader"');
    expect(elements).not.toContain("getStripePromise");
    expect(elements).not.toContain("reloadStripeForCheckout");
    expect(elements).not.toContain("delete (window");
    expect(page).not.toContain("preloadDahliaStripe");
    expect(page).not.toContain("stripeLoader");
    expect(offer).toContain("V3ElementsCheckout");
    expect(offer).not.toContain("CustomStripeCheckout");
  });

  it("confirm uses redirect if_required without client returnUrl", () => {
    const elements = readSrc("src/features/pet-v3/components/V3ElementsCheckout.tsx");
    expect(elements).toContain('redirect: "if_required"');
    expect(elements).not.toMatch(/confirm\([^\)]*returnUrl/);
    expect(elements).toContain("expressCheckoutConfirmEvent");
  });

  it("rejects legacy Custom Checkout cache secrets", () => {
    const now = 5_000_000;
    const local = installMemoryStorage();
    local.set(
      V3_CHECKOUT_SESSION_CACHE_KEY_LEGACY,
      JSON.stringify({
        orderId: "order-legacy",
        publicToken: "token-legacy",
        sessionId: "cs_test_legacy",
        clientSecret: "cs_test_legacy_secret_abc",
        publishableKey: "pk_test_51legacy00000000000",
        expiresAt: now + 60_000,
      }),
    );
    expect(readCachedV3EmbeddedCheckout(now)).toBeNull();
    expect(
      isValidCachedV3EmbeddedCheckout({
        sessionId: "cs_test_legacy",
        clientSecret: "cs_test_legacy_secret_abc",
        publishableKey: "pk_test_51legacy00000000000",
        checkoutMode: "custom",
        cacheVersion: 1,
      }),
    ).toBe(false);
    const recoverable = readRecoverableV3CheckoutOrder(now);
    expect(recoverable?.orderId).toBe("order-legacy");
    expect(V3_CHECKOUT_CACHE_VERSION).toBe(2);
    expect(V3_CHECKOUT_MODE_ELEMENTS).toBe("elements");
    expect(V3_CHECKOUT_SESSION_CACHE_KEY).toContain(".v2");
  });

  it("writes Elements cache with mode+version and clears legacy key", () => {
    const now = 6_000_000;
    const local = installMemoryStorage();
    local.set(V3_CHECKOUT_SESSION_CACHE_KEY_LEGACY, '{"orderId":"x"}');
    writeCachedV3EmbeddedCheckout({
      orderId: "order-el",
      publicToken: "token-el",
      sessionId: "cs_test_el",
      clientSecret: "cs_test_el_secret_abc",
      publishableKey: "pk_test_51elements000000000",
      expiresAt: now + 60_000,
    });
    expect(local.get(V3_CHECKOUT_SESSION_CACHE_KEY_LEGACY)).toBeUndefined();
    const cached = readCachedV3EmbeddedCheckout(now);
    expect(cached?.checkoutMode).toBe("elements");
    expect(cached?.cacheVersion).toBe(2);
    clearCachedV3EmbeddedCheckout();
    expect(readCachedV3EmbeddedCheckout(now)).toBeNull();
  });

  it("normalizes ui modes: elements on-page, embedded aliases custom, hosted separate", () => {
    expect(normalizeCheckoutUiMode("elements")).toBe("elements");
    expect(normalizeCheckoutUiMode("custom")).toBe("custom");
    expect(normalizeCheckoutUiMode("embedded")).toBe("custom");
    expect(normalizeCheckoutUiMode("hosted")).toBe("hosted");
    expect(normalizeCheckoutUiMode(undefined)).toBe("hosted");
    expect(isOnPageCheckoutUi("elements")).toBe(true);
    expect(isOnPageCheckoutUi("custom")).toBe(true);
    expect(isOnPageCheckoutUi("hosted")).toBe(false);
    expect(sessionMatchesRequestedUiMode("elements", "elements")).toBe(true);
    expect(sessionMatchesRequestedUiMode("custom", "elements")).toBe(false);
    expect(sessionMatchesRequestedUiMode("custom", "custom")).toBe(true);
  });

  it("hosted fallback reuses same order and requires checkout.stripe.com URL", () => {
    const hook = readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts");
    const offer = readSrc("src/features/pet-v3/screens/OfferScreen.tsx");
    expect(hook).toContain('uiMode: "hosted"');
    expect(hook).toContain("https://checkout.stripe.com/");
    expect(hook).toContain("hostedFallbackUsed");
    expect(offer).toContain("Continue to secure Stripe checkout — $12");
    expect(offer).toContain("startHostedFallback");
    expect(offer).toContain("validateAndUpdateV3OrderContact");
  });

  it("does not fire checkout_viewed on loading/error; Express onReady is not begin_checkout", () => {
    const elements = readSrc("src/features/pet-v3/components/V3ElementsCheckout.tsx");
    expect(elements).toContain('checkoutState.type === "success"');
    expect(elements).toContain("onReady?.()");
    expect(elements).toContain("Wallet availability is not Begin Checkout");
    expect(elements).toContain("setApplePayFromStripe");
  });

  it("keeps V1 Custom Checkout and V2 hosted unchanged", () => {
    const v1 = readSrc("src/features/pet/PetCheckoutPage.tsx");
    const v2 = readSrc("src/features/pet-v2/PetV2FunnelPage.tsx");
    const shared = readSrc("src/features/pet/components/CustomStripeCheckout.tsx");
    const loader = readSrc("src/features/pet/stripeLoader.ts");
    expect(v1).toContain('uiMode: "custom"');
    expect(v1).toContain("CustomStripeCheckout");
    expect(shared).toContain('from "../stripeLoader"');
    expect(v2).toContain("window.location.assign(result.checkoutUrl)");
    expect(v2).not.toContain('uiMode: "elements"');
    expect(loader).toContain("STRIPE_JS_RELEASE_TRAIN");
  });
});
