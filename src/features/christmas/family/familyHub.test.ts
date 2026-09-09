import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FAMILY_ASSETS,
  FAMILY_GALLERY,
  FAMILY_SCENE_CARDS,
  FAMILY_STYLE_CHIPS,
  STYLE_PREVIEW_BY_KEY,
} from "./assets";
import {
  FAMILY_COPY_KEYS,
  FAMILY_FAQS,
  familyDir,
  familyT,
} from "./copy";
import { familyPortraitJsonLd, familyPortraitSeo } from "./seo";
import { CHRISTMAS_PORTRAIT_VERTICALS } from "../portraitVerticals";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "../funnelEventContract";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("christmas family hub", () => {
  it("routes /christmas/family to ChristmasFamilyPage", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain("ChristmasFamilyPage");
    expect(app).toContain('path="/christmas/family"');
    expect(app.indexOf("ChristmasFamilyPage")).toBeLessThan(
      app.indexOf('path="/christmas/family"') + 80,
    );
    expect(readSrc("src/features/christmas/ChristmasFamilyPage.tsx")).toContain(
      "ChristmasFamilyExperience",
    );
  });

  it("ships SEO foundation with FAQ JSON-LD", () => {
    const seo = familyPortraitSeo("en");
    expect(seo.title.toLowerCase()).toContain("christmas family");
    expect(seo.url).toContain("/christmas/family");
    expect(seo.image).toContain(FAMILY_ASSETS.familyAfter);
    const jsonLd = familyPortraitJsonLd("en");
    const graph = (jsonLd as { "@graph": Array<Record<string, unknown>> })["@graph"];
    expect(graph.some((n) => n["@type"] === "FAQPage")).toBe(true);
    expect(graph.some((n) => n["@type"] === "SoftwareApplication")).toBe(true);
    expect(FAMILY_FAQS.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps Christmas-first copy without SaaS jargon above the fold", () => {
    expect(familyT("hero.h1")).toMatch(/magical Christmas portrait/i);
    expect(familyT("hero.cta")).toBe("Upload your photo");
    expect(familyT("hero.kicker")).toMatch(/DIGITAL GIFTER/i);
    expect(familyT("hero.lede").toLowerCase()).not.toMatch(/credits|replicate|model/);
    expect(familyT("seo.h1")).toMatch(/Magical Christmas Portrait/i);
    expect(FAMILY_COPY_KEYS.length).toBeGreaterThan(40);
    expect(familyDir("en")).toBe("ltr");
  });

  it("exposes Christmas style chips and gallery examples", () => {
    expect(FAMILY_STYLE_CHIPS.length).toBeGreaterThanOrEqual(6);
    expect(FAMILY_GALLERY.length).toBeGreaterThanOrEqual(6);
    expect(FAMILY_SCENE_CARDS.length).toBe(6);
    for (const chip of FAMILY_STYLE_CHIPS) {
      expect(STYLE_PREVIEW_BY_KEY[chip.styleKey] || chip.preview).toBeTruthy();
      expect(
        CHRISTMAS_PORTRAIT_VERTICALS.family.styles.some((s) => s.styleKey === chip.styleKey),
      ).toBe(true);
    }
  });

  it("registers family analytics events", () => {
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_family_page_view");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_family_upload_started");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_family_card_cross_sell");
  });

  it("experience is immersive Christmas world not slate SaaS funnel", () => {
    const src = readSrc(
      "src/features/christmas/family/ChristmasFamilyExperience.tsx",
    );
    expect(src).toContain("ff-hero");
    expect(src).toContain("AmbientSnow");
    expect(src).toContain("BeforeAfterSlider");
    expect(src).toContain("useChristmasPortraitFunnel");
    expect(src).toContain('mode: "vertical"');
    expect(src).not.toContain("max-w-lg");
    expect(src).not.toContain("bg-slate-900");
    expect(readSrc("src/features/christmas/family/FamilyPortrait.css")).toContain(
      "ff-hero__room",
    );
  });

  it("sitemap still lists family route", () => {
    expect(readSrc("api/sitemap.xml.ts")).toContain("/christmas/family");
  });
});
