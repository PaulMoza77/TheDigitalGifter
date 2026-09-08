import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  KIDS_CONSENT_VERSION,
  KIDS_PRODUCT_KEY,
  KIDS_RETENTION,
  KIDS_ROUTE,
  isKidsProductKey,
  kidsAnalyticsDimensions,
  kidsMediaAccessPolicy,
  kidsOrderMustStayPrivate,
  kidsRetentionDays,
  kidsRetentionDeleteAfter,
  validateKidsConsent,
} from "./kidsPrivacy";
import { CHRISTMAS_CATALOG_SEED, ctaStateForProduct, resolvePurchasableOffer } from "../catalog";
import { shellForPath } from "../routes";
import { verticalFromPathname } from "../portraitVerticals";
import { stylesForProductKey } from "../portraitStyles";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("kids consent + retention contract", () => {
  it("rejects missing guardian consent", () => {
    const result = validateKidsConsent({ guardianConsent: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("consent_required");
  });

  it("accepts consent and locks private visibility", () => {
    const result = validateKidsConsent({ guardianConsent: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.consentVersion).toBe(KIDS_CONSENT_VERSION);
    expect(result.visibility).toBe("private");
    expect(result.publicGallery).toBe(false);
  });

  it("decides retention windows for child-face media", () => {
    expect(kidsRetentionDays("unpaid_source")).toBe(7);
    expect(kidsRetentionDays("paid_source")).toBe(30);
    expect(kidsRetentionDays("paid_result")).toBe(90);
    expect(KIDS_RETENTION.consentAuditMonths).toBe(24);
    const from = new Date("2026-09-08T00:00:00.000Z");
    expect(kidsRetentionDeleteAfter("paid_result", from).toISOString()).toBe(
      "2026-12-07T00:00:00.000Z",
    );
  });

  it("never puts child names in analytics dimensions", () => {
    const dims = kidsAnalyticsDimensions({ styleKey: "kids_classic_christmas", hasConsent: true });
    expect(JSON.stringify(dims)).not.toMatch(/name|alex|child_first/i);
    expect(dims.public_gallery).toBe(false);
    expect(dims.visibility).toBe("private");
  });

  it("kids orders cannot leave private ACL", () => {
    expect(kidsOrderMustStayPrivate(KIDS_PRODUCT_KEY, "private")).toBe(true);
    expect(kidsOrderMustStayPrivate(KIDS_PRODUCT_KEY, "token_share")).toBe(false);
    expect(kidsMediaAccessPolicy().publicGallery).toBe(false);
    expect(kidsMediaAccessPolicy().noindex).toBe(true);
    expect(kidsMediaAccessPolicy().sitemapExcluded).toBe(true);
    expect(isKidsProductKey("christmas_photo")).toBe(false);
  });
});

describe("kids product is a real funnel, not a shell", () => {
  it("catalog is open experience with unpublished price", () => {
    const product = CHRISTMAS_CATALOG_SEED.find((p) => p.productKey === KIDS_PRODUCT_KEY);
    expect(product).toBeTruthy();
    expect(product?.metadata?.coming_soon).toBeFalsy();
    expect(product?.metadata?.kids_v1).toBe(true);
    expect(product?.metadata?.noindex).toBe(true);
    expect(product?.metadata?.public_gallery).toBe(false);
    expect(ctaStateForProduct(product!)).toBe("open");
    const offer = resolvePurchasableOffer({
      catalog: CHRISTMAS_CATALOG_SEED,
      productKey: KIDS_PRODUCT_KEY,
      packageKey: "single",
      clientAmountCents: 1999,
    });
    expect(offer.ok).toBe(false);
    if (!offer.ok) expect(offer.code).toBe("not_purchasable");
  });

  it("route is a portrait vertical with consent + noindex", () => {
    expect(shellForPath(KIDS_ROUTE)).toBeNull();
    const vertical = verticalFromPathname(KIDS_ROUTE);
    expect(vertical?.requiresGuardianConsent).toBe(true);
    expect(vertical?.noindex).toBe(true);
    expect(vertical?.hidePublicShare).toBe(true);
    expect(vertical?.styles.length).toBeGreaterThanOrEqual(6);
    expect(stylesForProductKey(KIDS_PRODUCT_KEY).every((s) => s.promptTemplate.includes("real age"))).toBe(
      true,
    );
  });

  it("App + hub + robots + sitemap keep kids private", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain(`path="${KIDS_ROUTE}" element={<ChristmasPortraitFunnelPage />}`);
    expect(app).not.toContain("ChristmasShellRoute");
    expect(readSrc("src/pages/website/ChristmasPage.tsx")).toContain("christmas_kids");
    expect(readSrc("src/features/christmas/ChristmasPortraitFunnelPage.tsx")).toContain("noindex={vertical.noindex}");
    expect(readSrc("src/features/christmas/ChristmasPortraitFunnelPage.tsx")).toContain("KIDS_CONSENT_LABEL");
    expect(readSrc("src/features/christmas/ChristmasPortraitFunnelPage.tsx")).toContain(
      "no public gallery or shareable page URL",
    );
    expect(readSrc("public/robots.txt")).toContain("Disallow: /christmas/kids");
    expect(readSrc("api/sitemap.xml.ts")).not.toContain("/christmas/kids");
  });

  it("server enforces consent and private ACL; mirrors client policy", () => {
    const checkout = readSrc("supabase/functions/christmas-checkout/index.ts");
    const generate = readSrc("supabase/functions/christmas-photo-generate/index.ts");
    const funnel = readSrc("supabase/functions/christmas-photo-funnel/index.ts");
    const denoPolicy = readSrc("supabase/functions/_shared/christmas/kidsPrivacy.ts");
    const clientPolicy = readSrc("src/features/christmas/kids/kidsPrivacy.ts");
    expect(checkout).toContain("validateKidsConsent");
    expect(checkout).toContain("consent_required");
    expect(funnel).toContain("uploads/kids/");
    expect(funnel).toContain("validateKidsConsent");
    expect(generate).toContain("consent_required");
    expect(generate).toContain("paid_result");
    expect(denoPolicy).toContain(KIDS_CONSENT_VERSION);
    expect(denoPolicy).toContain("unpaidSourceDays: 7");
    expect(clientPolicy).toContain("paidResultDays: 90");
    expect(readSrc("supabase/functions/_shared/christmas/portraitPromptRegistry.ts")).toContain(
      '"christmas_kids"',
    );
    expect(readSrc("supabase/migrations/20260908210000_christmas_kids_privacy_product.sql")).toContain(
      "christmas_orders_kids_private_chk",
    );
    expect(readSrc("supabase/migrations/20260908210000_christmas_kids_privacy_product.sql")).toContain(
      "purchasable = false",
    );
  });
});
