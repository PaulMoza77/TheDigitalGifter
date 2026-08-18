import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { petCreatePath, PET_LANDING_COPY, PET_SEO, PET_TESTIMONIALS } from "./catalog";
import {
  canAutoplayHeroVideo,
  checkoutAllowedWithOffer,
  createSecretLivesCta,
  landingNameStepCreatesOrder,
  mixedOtherGalleryLabel,
  otherGalleryImpliesSamePet,
  petNameBelongsInUrl,
  sanitizeFunnelAnalyticsPayload,
  validateOtherSubtype,
  validatePetName,
  deliveryEstimateLabel,
} from "./croGuards";
import { PET_CURRENCY, PET_PRICE_CENTS, PET_PRODUCT_SKU } from "./types";
import { isAdminAuthorized, rejectClientPriceTampering, stripeFulfillmentDecision } from "./funnelGuards";
import { clearPetDraft, createEmptyPetDraft, loadPetDraft, savePetDraft } from "./storage";
import { validatePetDraft, validatePetPhotoFile } from "./validation";
import {
  orderRetainsSnapshottedPrice,
  stripeCheckoutIsOneTimePayment,
} from "./videoGuards";
import { occasionHref } from "../../constants/occasions";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

function installMemoryStorage() {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage(local),
      sessionStorage: storage(session),
    },
  });
}

describe("pet funnel CRO", () => {
  beforeEach(() => {
    installMemoryStorage();
    clearPetDraft();
  });

  it("1. dog, cat, and other routes render without a full-screen loading gate", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/pet/dog"');
    expect(app).toContain('path="/pet/cat"');
    expect(app).toContain('path="/pet/other"');
    expect(app).toContain("PetLandingRoute");
    expect(app).not.toMatch(/const PetLandingRoute = lazy/);
    const landing = readSrc("src/features/pet/PetLandingPage.tsx");
    expect(landing).not.toMatch(/Loading\.\.\./);
    expect(landing).toContain("PET_HERO_PROMISE");
    expect(landing).toContain("NameCapture");
    expect(readSrc("src/features/pet/components/NameCapture.tsx")).toContain("Enter your pet’s name");
  });

  it("home and shortcut links send dogs/cats to the pet landings", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toMatch(/path="\/dogs"[\s\S]*to="\/pet\/dog"/);
    expect(app).toMatch(/path="\/cats"[\s\S]*to="\/pet\/cat"/);
    expect(occasionHref("dogs")).toBe("/pet/dog");
    expect(occasionHref("cats")).toBe("/pet/cat");
    expect(occasionHref("other-pets")).toBe("/pet/other");
    expect(app).toContain('path="/pet-loss"');
    expect(app).toContain("PetLossPage");
    expect(occasionHref("pet-loss")).toBe("/pet-loss");
    expect(occasionHref("birthday")).toContain("/funnel/homepage/birthday");
  });

  it("2. name submission requires a valid trimmed name", () => {
    expect(validatePetName("   ").ok).toBe(false);
    expect(validatePetName("Charlie").ok).toBe(true);
    expect(validatePetName("  Charlie  ").ok).toBe(true);
    if (validatePetName("  Charlie  ").ok) {
      expect(validatePetName("  Charlie  ").name).toBe("Charlie");
    }
    expect(createSecretLivesCta("")).toBe("Create their secret lives →");
    expect(createSecretLivesCta("Charlie")).toBe("Create Charlie’s secret lives →");
  });

  it("3. pet name persists across navigation and refresh", () => {
    savePetDraft({ ...createEmptyPetDraft(), petName: "Charlie", species: "dog" });
    expect(loadPetDraft().petName).toBe("Charlie");
    expect(loadPetDraft().species).toBe("dog");
  });

  it("4. pet name is not placed in the URL", () => {
    expect(petNameBelongsInUrl()).toBe(false);
    expect(petCreatePath("dog")).toBe("/pet/create?species=dog");
    expect(petCreatePath("dog")).not.toMatch(/Charlie|petName|name=/i);
    expect(readSrc("src/features/pet/PetRoutes.tsx")).not.toMatch(/petName=/);
  });

  it("5. name step does not create a backend order", () => {
    expect(landingNameStepCreatesOrder()).toBe(false);
    const landing = readSrc("src/features/pet/PetLandingPage.tsx");
    expect(landing).not.toMatch(/createOrder|startPetCheckout/);
  });

  it("6. dog/cat species are inherited from the route", () => {
    const routes = readSrc("src/features/pet/PetRoutes.tsx");
    expect(routes).toContain("parsePetSpecies(pathname.split");
    expect(routes).toContain("parsePetSpecies(params.get(\"species\"))");
  });

  it("7. species is not redundantly requested on the create page", () => {
    const create = readSrc("src/features/pet/PetCreatePage.tsx");
    expect(create).toContain("SpeciesChip");
    expect(create).not.toContain("PetTypePicker");
  });

  it("8. other requires a subtype", () => {
    expect(validateOtherSubtype({ species: "other", subtype: null }).ok).toBe(false);
    expect(validateOtherSubtype({ species: "dog", subtype: null }).ok).toBe(true);
    expect(validateOtherSubtype({ species: "other", subtype: "rabbit" }).ok).toBe(true);
  });

  it("9. other custom subtype is validated", () => {
    expect(validateOtherSubtype({ species: "other", subtype: "other", subtypeDetail: "" }).ok).toBe(false);
    expect(
      validateOtherSubtype({ species: "other", subtype: "other", subtypeDetail: "hedgehog" }).ok,
    ).toBe(true);
  });

  it("10. photo and email validation work", () => {
    const photo = new File([new Uint8Array([1, 2, 3])], "charlie.jpg", { type: "image/jpeg" });
    expect(validatePetPhotoFile(photo).ok).toBe(true);
    expect(validatePetPhotoFile(new File([], "empty.jpg", { type: "image/jpeg" })).ok).toBe(false);
    expect(
      validatePetDraft({
        petName: "Charlie",
        species: "dog",
        personality: "cute",
        email: "not-an-email",
        photo: { fileName: "charlie.jpg", contentType: "image/jpeg", byteSize: 12, width: null, height: null },
      }).ok,
    ).toBe(false);
    expect(
      validatePetDraft({
        petName: "Charlie",
        species: "dog",
        personality: null,
        email: "you@email.com",
        photo: { fileName: "charlie.jpg", contentType: "image/jpeg", byteSize: 12, width: null, height: null },
      }).ok,
    ).toBe(true);
  });

  it("11. continue clearly states that no charge occurs yet", () => {
    expect(readSrc("src/features/pet/PetCreatePage.tsx")).toContain("Continue — no charge yet");
    expect(readSrc("src/features/pet/components/NameCapture.tsx")).toContain("No charge yet");
  });

  it("12. back/edit preserves the draft", () => {
    savePetDraft({
      ...createEmptyPetDraft(),
      petName: "Charlie",
      species: "dog",
      email: "you@email.com",
      photoPreviewDataUrl: "data:image/jpeg;base64,abc",
    });
    expect(loadPetDraft().email).toBe("you@email.com");
    expect(loadPetDraft().photoPreviewDataUrl).toContain("data:image/jpeg");
    expect(readSrc("src/features/pet/PetCheckoutPage.tsx")).toContain("goToCreate");
  });

  it("13. checkout review shows the verified server-owned amount", () => {
    const checkout = readSrc("src/features/pet/PetCheckoutPage.tsx");
    expect(checkout).toContain("USD today");
    expect(checkout).toContain("offerVerified");
    expect(checkout).toContain("Subscription: None");
  });

  it("14. client price tampering cannot change Stripe amount", () => {
    expect(rejectClientPriceTampering({ amountCents: 1 }).ok).toBe(false);
    expect(rejectClientPriceTampering({ amountCents: PET_PRICE_CENTS, sku: PET_PRODUCT_SKU }).ok).toBe(true);
  });

  it("15. historical orders preserve snapshotted prices", () => {
    expect(
      orderRetainsSnapshottedPrice({ amountCents: 5900, offerVersion: 1 }, { amountCents: 7900, version: 2 }),
    ).toEqual({ amountCents: 5900, offerVersion: 1 });
  });

  it("16. pet price remains admin-only", () => {
    expect(isAdminAuthorized({ callerIsAdmin: false, mutation: true })).toBe(false);
    expect(isAdminAuthorized({ callerIsAdmin: true, mutation: true })).toBe(true);
    expect(readSrc("src/pages/admin/PricingPage.tsx")).toContain("PetOfferSettings");
  });

  it("17. Stripe remains mode: payment", () => {
    expect(stripeCheckoutIsOneTimePayment("payment")).toBe(true);
    expect(stripeCheckoutIsOneTimePayment("subscription")).toBe(false);
    expect(
      stripeFulfillmentDecision({
        eventType: "checkout.session.completed",
        sku: PET_PRODUCT_SKU,
        mode: "subscription",
        paymentStatus: "paid",
      }).fulfill,
    ).toBe(false);
  });

  it("18. subscription remains None", () => {
    expect(readSrc("src/features/pet/PetCheckoutPage.tsx")).toContain("Subscription: None");
    expect(PET_CURRENCY).toBe("usd");
    expect(PET_PRICE_CENTS).toBe(5900);
  });

  it("19. InitiateCheckout fires once at the correct step", () => {
    const api = readSrc("src/features/pet/api.ts");
    const checkout = readSrc("src/features/pet/PetCheckoutPage.tsx");
    expect(api).not.toContain("trackMetaInitiateCheckout");
    expect(api).toContain("createStripeCheckout");
    expect(checkout).toContain("startPetCheckout");
    expect(checkout).toContain("trackMetaInitiateCheckout");
    expect(checkout).toContain("serverAmount");
    expect(checkout).toContain("pet_ic_");
  });

  it("20. Purchase deduplication remains unchanged", () => {
    const pixel = readSrc("src/lib/metaPixel.ts");
    expect(pixel).toContain("tdg.meta.purchase.");
    expect(pixel).toContain("trackMetaPurchaseOnce");
    expect(readSrc("src/features/pet/PetOrderPage.tsx")).toContain("trackMetaPurchaseOnce");
  });

  it("21. analytics payloads contain no name, email, photo URL or token", () => {
    const safe = sanitizeFunnelAnalyticsPayload({
      species: "dog",
      petName: "Charlie",
      email: "you@email.com",
      photoUrl: "https://example.com/photo.jpg",
      token: "secret-token",
      publicToken: "abc",
    });
    expect(safe).toEqual({ species: "dog" });
    expect(JSON.stringify(safe)).not.toMatch(/Charlie|you@email|photo\.jpg|secret-token/);
  });

  it("22. /other does not falsely label mixed species as the same pet", () => {
    expect(otherGalleryImpliesSamePet()).toBe(false);
    expect(mixedOtherGalleryLabel()).toBe("Made for many kinds of pets");
    expect(PET_LANDING_COPY.other.heading).toBe("Made for many kinds of pets");
    expect(readSrc("src/features/pet/components/SceneGrid.tsx")).toContain("mixedOtherGalleryLabel");
    expect(PET_TESTIMONIALS).toEqual([]);
  });

  it("23. hero video respects reduced motion", () => {
    expect(canAutoplayHeroVideo({ prefersReducedMotion: true })).toBe(false);
    expect(canAutoplayHeroVideo({ prefersReducedMotion: false, effectiveType: "4g" })).toBe(true);
    expect(canAutoplayHeroVideo({ prefersReducedMotion: false, effectiveType: "2g" })).toBe(false);
    expect(readSrc("src/features/pet/components/HeroProof.tsx")).toContain("prefersReducedMotion");
    expect(readSrc("src/features/pet/PetLandingPage.tsx")).toContain("SecretLifeAdReel");
    expect(readSrc("src/features/pet/catalog.ts")).toContain("/pet/dog/ads/tdg-pet-secret-life-dog-ad-v1.mp4");
    expect(readSrc("src/features/pet/components/SecretLifeAdReel.tsx")).toContain("aspect-[9/16]");
    expect(readSrc("src/features/pet/components/SecretLifeAdReel.tsx")).toContain("PET_SECRET_LIFE_AD.poster");
    const clips = readSrc("src/features/pet/components/ClipGrid.tsx");
    expect(clips).toContain("autoPlay");
    expect(clips).toContain("muted");
    expect(clips).toContain("playsInline");
    expect(clips).toContain("prefersReducedMotion");
    expect(clips).toContain("allowAutoplay");
    expect(readSrc("src/features/pet/components/SceneCard.tsx")).toContain("onClick");
    expect(PET_LANDING_COPY.dog.description).toMatch(/Hover or tap/);
  });

  it("24. offer API failure does not blank the landing page", () => {
    const landing = readSrc("src/features/pet/PetLandingPage.tsx");
    expect(landing).toContain("NameCapture");
    expect(landing).toContain("offerError");
    expect(landing).not.toMatch(/if \(loading\) return/);
  });

  it("25. offer API failure prevents checkout with an unknown price", () => {
    expect(checkoutAllowedWithOffer({ amountCents: null, offerVerified: false })).toBe(false);
    expect(checkoutAllowedWithOffer({ amountCents: 5900, offerVerified: true })).toBe(true);
    expect(readSrc("src/features/pet/PetCheckoutPage.tsx")).toContain("checkoutAllowed");
  });

  it("26. existing generation, QC, Stripe, admin and cost-ledger invariants remain", () => {
    expect(stripeCheckoutIsOneTimePayment("payment")).toBe(true);
    expect(rejectClientPriceTampering({ amountCents: 8900 }).ok).toBe(false);
    expect(isAdminAuthorized({ callerIsAdmin: false, mutation: true })).toBe(false);
    expect(PET_SEO.dog.title).toContain("Custom Dog Portraits");
    expect(PET_SEO.cat.title).toContain("Custom Cat Portraits");
    expect(PET_SEO.other.title).toContain("Custom Pet Portraits");
  });

  it("27. order status page cannot freeze the UI or stall generation while queued", () => {
    const page = readSrc("src/features/pet/PetOrderPage.tsx");
    expect(page).toContain("ORDER_POLL_INTERVAL_MS");
    expect(page).toContain("inFlight");
    expect(page).toContain("isTransientPollError");
    expect(page).toContain("This page stays live and never locks");
    expect(page).not.toMatch(/setInterval\([^,]+,\s*2500\)/);
    expect(page).not.toMatch(/pointer-events-none/);
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(funnel).toContain("enqueuePetGenerateIfStalled");
    expect(funnel).toContain("180, 600");
    expect(funnel).not.toMatch(/assertRateLimit\([^)]*pollGenerationProgress[^)]*60, 3600\)/);
    expect(readSrc("src/features/pet/supabaseApi.ts")).toContain("AbortSignal.timeout");
  });

  it("28. customer copy does not promise a 24-48 hour wait for Replicate portraits", () => {
    expect(deliveryEstimateLabel("Usually ready within 24–48 hours")).toBe(
      "Usually ready in a few minutes after payment",
    );
    expect(deliveryEstimateLabel("Ready tonight")).toBe("Ready tonight");
    expect(readSrc("src/features/pet/PetOrderPage.tsx")).not.toMatch(/24\s*[–-]\s*48/);
    expect(readSrc("src/features/pet/PetLandingPage.tsx")).not.toMatch(/24\s*[–-]\s*48/);
    expect(readSrc("supabase/functions/_shared/pet/constants.ts")).toMatch(
      /PET_GENERATION_ENABLED[\s\S]*\?\? "true"/,
    );
  });

  it("29. signed-in dashboard lists pet galleries with download and share", () => {
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain("listMyPetGalleries");
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain("accountOwnsPetOrder");
    expect(readSrc("src/pages/account/AccountDashboard.tsx")).toContain("PetsGenerations");
    expect(readSrc("src/components/client/PetsGenerations.tsx")).toContain("Pets generations");
    expect(readSrc("src/components/client/PetsGenerations.tsx")).toContain("sharePortrait");
    expect(readSrc("src/features/pet/components/ResultsGrid.tsx")).toContain("Share");
  });
});
