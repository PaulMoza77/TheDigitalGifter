import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PHOTO_GEN_COPY_KEYS, photoGenT } from "./copy";
import { photoGeneratorSeo, photoGeneratorJsonLd } from "./seo";
import { commerceForSubjectChoice } from "../subjectCommerce";
import { enabledChristmasStyles } from "../styles";
import { GALLERY_EXAMPLES, HERO_EXAMPLES } from "./assets";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "../funnelEventContract";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("christmas photo generator hub rebuild", () => {
  it("ships i18n-ready copy keys and SEO metadata", () => {
    expect(PHOTO_GEN_COPY_KEYS.length).toBeGreaterThan(40);
    expect(photoGenT("seo.title")).toMatch(/AI Christmas Photo Generator/i);
    expect(photoGenT("hero.cta")).toMatch(/Create My Christmas Photo/i);
    const seo = photoGeneratorSeo("en");
    expect(seo.url).toContain("/christmas/photo-generator");
    expect(seo.description.length).toBeGreaterThan(40);
    const ld = photoGeneratorJsonLd("en");
    expect(JSON.stringify(ld)).toContain("FAQPage");
    expect(JSON.stringify(ld)).toContain("BreadcrumbList");
  });

  it("covers family / couple / pet example categories", () => {
    expect(HERO_EXAMPLES.family.after).toBeTruthy();
    expect(HERO_EXAMPLES.couples.after).toBeTruthy();
    expect(HERO_EXAMPLES.pets.after).toBeTruthy();
    expect(GALLERY_EXAMPLES.map((e) => e.id)).toEqual(
      expect.arrayContaining(["family", "couple", "dog", "cat", "family-pet"]),
    );
  });

  it("maps hub subject choice to commerce products", () => {
    expect(commerceForSubjectChoice("family").productKey).toBe("christmas_family");
    expect(commerceForSubjectChoice("couple").productKey).toBe("christmas_couple");
    expect(commerceForSubjectChoice("pet").productKey).toBe("christmas_pet");
    expect(commerceForSubjectChoice("person").productKey).toBe("christmas_photo");
    expect(enabledChristmasStyles(commerceForSubjectChoice("family").styles).length).toBeGreaterThanOrEqual(6);
  });

  it("registers dedicated analytics events", () => {
    for (const name of [
      "christmas_photo_generator_page_view",
      "christmas_photo_upload_started",
      "christmas_photo_upload_completed",
      "christmas_photo_subject_selected",
      "christmas_photo_style_selected",
      "christmas_photo_generation_started",
      "christmas_photo_generation_completed",
      "christmas_photo_style_retry",
      "christmas_photo_downloaded",
      "christmas_photo_shared",
      "christmas_photo_card_cross_sell",
    ]) {
      expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain(name);
    }
  });

  it("hub experience includes before/after, upload, subject, styles, FAQ", () => {
    const page = readSrc(
      "src/features/christmas/photoGenerator/ChristmasPhotoGeneratorExperience.tsx",
    );
    expect(page).toContain("BeforeAfterSlider");
    expect(page).toContain("subject.h2");
    expect(page).toContain("hero.cta");
    expect(page).toContain("/christmas/family");
    expect(page).toContain("/christmas/couples");
    expect(page).toContain("/christmas/pets");
    expect(page).toContain("christmas_photo_generator_page_view");
    expect(photoGenT("hero.cta")).toBe("Create My Christmas Photo");
    expect(readSrc("api/sitemap.xml.ts")).toContain("/christmas/photo-generator");
    expect(readSrc("api/sitemap.xml.ts")).toContain("/christmas/dogs");
  });

  it("keeps pre-pay blur preview and never trusts client prompts in hub path", () => {
    const hook = readSrc("src/features/christmas/useChristmasPortraitFunnel.ts");
    expect(hook).toContain("createBlurredOriginalPreview");
    expect(hook).toContain('mode === "hub" ? "subject" : "style"');
    expect(hook).not.toContain("replicate.com");
  });
});
