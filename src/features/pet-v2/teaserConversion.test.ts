import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  boxBlurInPlace,
  pixelateInPlace,
  teaserLooksDestructivelyTransformed,
  V2_TEASER_BUDGET_MS,
} from "./teaser";
import { PET_V2_PRICE_CENTS, PET_V2_PRICE_DISPLAY } from "./types";
import { classifyProviderAvailabilityError } from "./providerStatus";
import { mapV2CountsToPrimarySteps } from "../pet/funnelDatasetConfig";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

/** Minimal 2d context stub so pixelate/blur can run without the canvas native package. */
function stubContext(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  // left half red, right half blue
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (x < width / 2) {
        data[i] = 255;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      } else {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
  }
  const image = { data, width, height } as ImageData;
  return {
    getImageData: () => ({ data: data.slice(0), width, height }) as ImageData,
    putImageData: (next: ImageData) => {
      data.set(next.data);
    },
    _data: data,
    _snapshot: () => data.slice(0),
  } as unknown as CanvasRenderingContext2D & { _snapshot: () => Uint8ClampedArray };
}

describe("V2 teaser conversion rebuild", () => {
  it("wires local teaser (no Replicate) into the funnel page", () => {
    const page = readSrc("src/features/pet-v2/PetV2FunnelPage.tsx");
    expect(page).not.toContain("requestV2Preview");
    expect(page).not.toContain("pet-v2-preview");
    expect(page).toContain("buildV2PersonalizedTeaser");
    expect(readSrc("src/features/pet-v2/teaser.ts")).toContain("pixelateInPlace");
    expect(readSrc("src/features/pet-v2/teaser.ts")).toContain("boxBlurInPlace");
    expect(V2_TEASER_BUDGET_MS).toBe(5000);
    expect(teaserLooksDestructivelyTransformed("data:image/jpeg;base64," + "A".repeat(900))).toBe(true);
  });

  it("pixelates and blurs into bitmap pixels (not CSS-only)", () => {
    const ctx = stubContext(40, 40);
    const before = (ctx as unknown as { _snapshot: () => Uint8ClampedArray })._snapshot();
    pixelateInPlace(ctx, 40, 40, 8);
    boxBlurInPlace(ctx, 40, 40, 6);
    const after = (ctx as unknown as { _snapshot: () => Uint8ClampedArray })._snapshot();
    let changed = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2]) {
        changed += 1;
      }
    }
    expect(changed).toBeGreaterThan(10);
  });

  it("enforces server-side $0.99 and ignores browser price trust", () => {
    expect(PET_V2_PRICE_CENTS).toBe(99);
    expect(PET_V2_PRICE_DISPLAY).toBe("$0.99");
    expect(readSrc("supabase/functions/_shared/pet/constants.ts")).toContain("PET_V2_PRICE_CENTS = 99");
    expect(readSrc("supabase/functions/_shared/pet/flashSale.ts")).toContain("return PET_V2_PRICE_CENTS");
    expect(readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts")).toContain("PET_V2_PRICE_CENTS");
    expect(readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts")).toContain('funnelVariant: "v2"');
  });

  it("uses Elements Express Checkout with Apple Pay first and non-Apple fallbacks", () => {
    const ui = readSrc("src/features/pet-v2/components/V2ElementsCheckout.tsx");
    const options = readSrc("src/features/pet/expressCheckoutOptions.ts");
    expect(ui).toContain("ExpressCheckoutElement");
    expect(ui).toContain("PET_EXPRESS_CHECKOUT_OPTIONS");
    expect(options).toContain('applePay: "auto"');
    expect(options).toContain('paymentMethodOrder: ["applePay", "googlePay"]');
    expect(ui).toContain("PaymentElement");
    expect(options).toContain('link: "auto"');
    expect(ui).toContain("Or pay with card");
  });

  it("wires Apple Pay association outside the SPA catch-all", () => {
    const vercel = readSrc("vercel.json");
    expect(vercel).toContain("apple-developer-merchantid-domain-association");
    expect(vercel).toContain("\\.well-known/");
    const api = readSrc("api/apple-developer-merchantid-domain-association.ts");
    expect(api).toContain("STRIPE_APPLE_PAY_DOMAIN_ASSOCIATION");
    expect(api).toContain("application/octet-stream");
    expect(api).toContain("Must never return SPA HTML");
    expect(api).toContain("STRIPE_APPLE_PAY_DOMAIN_ASSOCIATION_FALLBACK");
    // Stripe's universal association file — served statically from public/ (Vercel + VPS).
    const association = readSrc("public/.well-known/apple-developer-merchantid-domain-association");
    expect(association).not.toContain("PLACEHOLDER_CONFIGURE");
    expect(association.length).toBeGreaterThan(1000);
    expect(association).toMatch(/^7B22/);
  });

  it("cancel URL restores with checkout=canceled", () => {
    const hook = readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts");
    expect(hook).toContain("checkout=canceled");
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).toContain('checkout") !== "canceled"');
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).toContain("v2_checkout_canceled");
  });

  it("classifies Replicate 402/429/5xx for circuit breaker", () => {
    expect(classifyProviderAvailabilityError("402: insufficient credit").reason).toBe("insufficient_credit");
    expect(classifyProviderAvailabilityError("429 rate limit").reason).toBe("rate_limited");
    expect(classifyProviderAvailabilityError("503").reason).toBe("provider_error");
  });

  it("blocks checkout creation when fulfillment is unavailable", () => {
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(funnel).toContain("PROVIDER_UNAVAILABLE");
    expect(funnel).toContain("billing_required");
    expect(funnel).toContain("PET_FULFILLMENT_ENABLED");
    expect(readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts")).toContain("ensureV2CheckoutAllowed");
    expect(readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts")).toContain("v2_provider_unavailable");
    expect(readSrc("src/features/pet-v2/providerStatus.ts")).toContain("/api/pet-provider-status");
    expect(readSrc("src/features/pet-v2/providerStatus.ts")).toContain("missing_token");
    expect(readSrc("src/features/pet-v2/providerStatus.ts")).toContain("probe_token_absent");
    expect(readSrc("api/pet-provider-status.ts")).toContain("REPLICATE_API_TOKEN");
    expect(readSrc("api/pet-provider-status.ts")).toContain("insufficient_credit");
    // Missing Vercel token must not fail-closed — fulfillment uses Edge secrets.
    expect(readSrc("api/pet-provider-status.ts")).toContain("probe_token_absent");
    expect(readSrc("api/pet-provider-status.ts")).toContain('available: true, reason: "probe_token_absent"');
  });

  it("resizes checkout uploads and warms Stripe/provider before Elements", () => {
    const hook = readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts");
    expect(hook).toContain("prepareV2CheckoutUpload");
    expect(hook).toContain("Promise.all");
    expect(hook).toContain("loadingPhase");
    expect(readSrc("src/features/pet-v2/photo.ts")).toContain("prepareV2CheckoutUpload");
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).toContain("warmV2CheckoutDependencies");
    expect(readSrc("src/features/pet-v2/checkoutWarmup.ts")).toContain("js.stripe.com");
    expect(readSrc("src/features/pet/supabaseApi.ts")).toContain("30_000");
    expect(readSrc("index.html")).toContain("https://js.stripe.com");
  });

  it("skips redundant Stripe session re-fetch when create already returns client_secret", () => {
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(funnel).toContain("asString(session.client_secret)");
    expect(funnel).toContain("asString(session.id)");
  });

  it("maps new teaser analytics into admin KPI cards", () => {
    const mapped = mapV2CountsToPrimarySteps({
      v2_landing_view: 79,
      v2_upload_completed: 27,
      v2_teaser_viewed: 10,
      v2_offer_viewed: 3,
      v2_begin_checkout: 0,
      v2_purchase: 0,
    });
    expect(mapped.landing_view).toBe(79);
    expect(mapped.pet_name_submitted).toBe(27);
    expect(mapped.photo_upload_completed).toBe(10);
    expect(mapped.order_review_viewed).toBe(3);
    expect(mapped.initiate_checkout).toBe(0);
  });

  it("keeps webhook as canonical purchase and paid-generation start", () => {
    const fulfill = readSrc("supabase/functions/_shared/pet/stripeFulfill.ts");
    expect(fulfill).toContain('p_event_name: "v2_purchase"');
    expect(fulfill).toContain('p_event_name: "v2_paid_generation_started"');
    expect(fulfill).toContain("enqueuePetGenerate");
  });

  it("does not expose fake already-generated artwork claims", () => {
    const teaser = readSrc("src/features/pet-v2/screens/TeaserOfferScreen.tsx");
    expect(teaser).not.toMatch(/14 images are already generated/i);
    expect(teaser).toContain("secret life is ready to be revealed");
    expect(teaser).toContain("PET_V2_PRICE_DISPLAY");
    expect(PET_V2_PRICE_DISPLAY).toBe("$0.99");
  });

  it("allows pet-name-only contact save without rejecting bootstrap placeholder email", () => {
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    const hook = readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts");
    const ui = readSrc("src/features/pet-v2/components/V2ElementsCheckout.tsx");
    const teaser = readSrc("src/features/pet-v2/screens/TeaserOfferScreen.tsx");
    // Backend must not hard-reject pending+… placeholders (blocks Apple Pay when name is filled).
    expect(funnel).toContain("emailIsPlaceholder");
    expect(funnel).toContain("emailIsReal");
    expect(funnel).toContain("Pet-name-only update");
    expect(funnel).toContain("keep existing order email");
    expect(funnel).toContain("emailIsReal");
    expect(funnel).toMatch(/if \(sessionId && stripeKey && emailIsReal\)/);
    // Client documents the optional-field path used before Express confirm.
    expect(hook).toContain('from "./v2ContactUpdate"');
    expect(readSrc("src/features/pet-v2/v2ContactUpdate.ts")).toContain(
      "Pet-name-only still sends the bootstrap pending+ email",
    );
    expect(readSrc("src/features/pet-v2/v2ContactUpdate.ts")).toContain(
      "petNameOnly: hasPetName && !hasEmail",
    );
    // Express sheet must be failed closed when contact gate blocks confirm.
    expect(ui).toContain("paymentFailed");
    expect(ui).toContain('reason: "fail"');
    // Apple Pay must confirm immediately — no await onBeforeConfirm before checkout.confirm().
    expect(ui).toContain("isExpressCheckoutConfirmEvent");
    expect(ui).toContain("never block Express");
    expect(ui).toContain("CARD_PAY_INCOMPLETE_MESSAGE");
    expect(teaser).toContain("validateAndUpdateV2OrderContact");
    expect(teaser).toContain("setTimeout");
  });
});
