import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_PACK_OFFERS, CHRISTMAS_PACKS } from "./config";
import { validateChristmasPhotoFile } from "./photo";
import { availableUpsellPacks } from "./screens/UpsellScreen";
import {
  CHRISTMAS_V2_FIXTURE_BANNER,
  fixtureSceneResults,
  parseChristmasV2OrderFixture,
} from "./testFixture";

function read(relative: string) {
  return readFileSync(resolve(relative), "utf8");
}

describe("christmas-v2 funnel UX contracts", () => {
  it("exposes all three EUR packs with exact entitlements and CTAs", () => {
    expect(CHRISTMAS_PACKS.starter).toMatchObject({
      amountCents: 700,
      imageCount: 3,
      videoCount: 0,
      priceDisplay: "€7",
    });
    expect(CHRISTMAS_PACKS.magic).toMatchObject({
      amountCents: 1700,
      imageCount: 5,
      videoCount: 1,
      priceDisplay: "€17",
    });
    expect(CHRISTMAS_PACKS.ultimate).toMatchObject({
      amountCents: 2700,
      imageCount: 10,
      videoCount: 3,
      priceDisplay: "€27",
    });
    expect(CHRISTMAS_PACK_OFFERS.starter.cta).toContain("€7");
    expect(CHRISTMAS_PACK_OFFERS.magic.cta).toContain("€17");
    expect(CHRISTMAS_PACK_OFFERS.ultimate.cta).toContain("€27");
  });

  it("offer screen lists starter/magic/ultimate and continues with selected pack", () => {
    const offer = read("src/features/christmas-v2/screens/OfferScreen.tsx");
    expect(offer).toContain('data-testid="cv2-offer-packs"');
    expect(offer).toContain('data-testid={`cv2-pack-${key}`}');
    expect(offer).toContain("role=\"radiogroup\"");
    expect(offer).toContain("Local preview only · not AI-generated yet");
    const funnel = read("src/features/christmas-v2/ChristmasV2FunnelPage.tsx");
    expect(funnel).toContain("selectedPackKey={packKey}");
    expect(funnel).toContain("packKey,");
    expect(funnel).toContain("useChristmasEmbeddedCheckout({");
    expect(funnel).not.toMatch(/useChristmasEmbeddedCheckout\(\{[\s\S]*?packKey:\s*"starter"/);
  });

  it("checkout summary shows amount and BLOCKED tax note without inventing tax", () => {
    const checkout = read("src/features/christmas-v2/screens/CheckoutScreen.tsx");
    expect(checkout).toContain('data-testid="cv2-order-summary"');
    expect(checkout).toContain('data-testid="cv2-tax-blocked-note"');
    expect(checkout).toContain("Tax configuration for this funnel is unresolved (BLOCKED)");
    expect(checkout).toContain("Amount due at checkout");
    expect(checkout).toContain("packKey: ChristmasPackKey");
  });

  it("keeps pre-purchase packs separate from optional post-purchase upsells", () => {
    expect(availableUpsellPacks("starter")).toEqual(["magic", "ultimate"]);
    expect(availableUpsellPacks("magic")).toEqual(["ultimate"]);
    expect(availableUpsellPacks("ultimate")).toEqual([]);
    const upsell = read("src/features/christmas-v2/screens/UpsellScreen.tsx");
    expect(upsell).toContain("Optional upgrade");
    expect(upsell).toContain("not a subscription");
    expect(upsell).not.toContain("Surprise Me ✨");
  });

  it("validates upload MIME/size and explains HEIC clearly", () => {
    expect(
      validateChristmasPhotoFile(
        new File([new Uint8Array([1])], "shot.heic", { type: "image/heic" }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      validateChristmasPhotoFile(
        new File([new Uint8Array([1, 2, 3])], "shot.jpg", { type: "image/jpeg" }),
      ),
    ).toMatchObject({ ok: true, contentType: "image/jpeg" });
    expect(
      validateChristmasPhotoFile(
        new File([new Uint8Array(16 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" }),
      ).ok,
    ).toBe(false);
    const landing = read("src/features/christmas-v2/screens/LandingScreen.tsx");
    expect(landing).toContain("HEIC is not supported");
    expect(landing).toContain("Local photo preview · AI portraits generate after payment");
    expect(landing).toContain('data-testid="cv2-sticky-upload-cta"');
  });

  it("order fixture is explicitly labeled and never looks like a live payment", () => {
    expect(parseChristmasV2OrderFixture("?fixture=1&demo=results&pack=magic")).toEqual({
      mode: "results",
      packKey: "magic",
    });
    expect(parseChristmasV2OrderFixture("?token=abc")).toBeNull();
    expect(CHRISTMAS_V2_FIXTURE_BANNER).toMatch(/TEST FIXTURE/i);
    expect(CHRISTMAS_V2_FIXTURE_BANNER).toMatch(/not a real payment/i);
    const scenes = fixtureSceneResults(3);
    expect(scenes).toHaveLength(3);
    expect(scenes[0]?.imageUrl?.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("shell footer keeps one-time / no subscription language", () => {
    const shell = read("src/features/christmas-v2/ChristmasV2Shell.tsx");
    expect(shell).toContain("One-time purchase · no subscription");
    expect(shell.toLowerCase()).not.toContain("subscribe");
  });
});
