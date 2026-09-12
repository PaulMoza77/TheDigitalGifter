import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_CLUB_COUNTDOWN_PRODUCTS } from "./config";
import { productForCountdownUnit } from "./ChristmasCountdown";
import { clubT, PACKS, REQUIRED_UI_KEYS, resolveClubLocale } from "./copy";
import { clubEmailValidationMessage, isValidClubEmail, normalizeClubEmail } from "./email";
import {
  ChristmasClubSignupError,
  isMissingRelationStatus,
  isUniqueViolationStatus,
  validateChristmasClubSignupPayload,
} from "./signupContract";

describe("christmas club countdown products", () => {
  it("places one product inside each countdown unit", () => {
    expect(CHRISTMAS_CLUB_COUNTDOWN_PRODUCTS).toHaveLength(4);
    expect(productForCountdownUnit("days")?.productKey).toBe("christmas_family");
    expect(productForCountdownUnit("hours")?.href).toBe("/christmas/photo-generator");
    expect(productForCountdownUnit("minutes")?.image).toContain("/christmas/prints/pets");
    expect(productForCountdownUnit("seconds")?.name).toBe("Cards");
  });
});

describe("christmas club gifts link", () => {
  it("exposes a stable /christmas/tree-gifts route for the bottom story CTA", async () => {
    const { CHRISTMAS_CLUB_GIFTS_ROUTE } = await import("./config");
    expect(CHRISTMAS_CLUB_GIFTS_ROUTE).toBe("/christmas/tree-gifts");
  });
});

describe("christmas club live cabin + gift tree", () => {
  it("plays a desktop cabin loop and a dedicated mobile cabin loop", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const scene = readFileSync(resolve(process.cwd(), "src/features/christmas/club/ChristmasClubScene.tsx"), "utf8");
    const config = readFileSync(resolve(process.cwd(), "src/features/christmas/club/config.ts"), "utf8");
    const boot = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    expect(config).toContain("cabin-hero-loop.mp4");
    expect(config).toContain("cabin-hero-loop-720.mp4");
    expect(config).toContain('CHRISTMAS_CLUB_DESKTOP_MEDIA = "(min-width: 901px)"');
    expect(scene).toContain("CHRISTMAS_CLUB_DESKTOP_MEDIA");
    expect(scene).toContain("heroLoop720");
    expect(boot).toContain("cabin-hero-loop.mp4?v=seedance1");
    expect(boot).toContain("cabin-hero-loop-720.mp4?v=seedance1");
  });

  it("embeds the framed live gift tree, then the original story scenes", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const page = readFileSync(resolve(process.cwd(), "src/features/christmas/club/ChristmasClubPage.tsx"), "utf8");
    const landing = readFileSync(
      resolve(process.cwd(), "src/features/christmas/landing/ChristmasLandingExperience.tsx"),
      "utf8",
    );
    const gifts = readFileSync(resolve(process.cwd(), "src/features/christmas/gifts/ChristmasGiftsPage.tsx"), "utf8");
    const tree = readFileSync(resolve(process.cwd(), "src/features/christmas/gifts/ChristmasTreeScene.tsx"), "utf8");
    const media = readFileSync(resolve(process.cwd(), "src/features/christmas/gifts/giftTreeMedia.ts"), "utf8");
    const santa = readFileSync(resolve(process.cwd(), "src/features/christmas/landing/assets.ts"), "utf8");
    expect(page).toContain("ChristmasLandingExperience");
    expect(page).toContain("includeHero={false}");
    expect(page).not.toContain("fillViewport");
    // Chrome rejects <link rel=preload as=video>; scene <video> owns the loop fetch.
    expect(page).not.toMatch(/rel\s*=\s*[`'"]preload[`'"][\s\S]{0,80}as\s*=\s*[`'"]video[`'"]/);
    expect(page).not.toMatch(/\.as\s*=\s*[`'"]video[`'"]/);
    expect(landing).toContain("GiftTreeLandingScene");
    expect(landing).toContain("PortraitScene");
    expect(landing).toContain("SantaScene");
    expect(landing).toContain("TreeScene");
    expect(landing).toContain("AdventScene");
    expect(landing).toContain("WishlistScene");
    expect(landing).toContain("CardsScene");
    expect(landing).toContain("StoryErrorBoundary");
    expect(santa).toContain("advent-loop.mp4");
    expect(santa).toContain("cover-elegant.webp");
    expect(santa).toContain("message-letter.webp");
    expect(gifts).toContain("h-[min(78svh,640px)]");
    expect(tree).toContain("mobileMp4");
    expect(tree).toContain("desktopMp4");
    expect(media).toContain("scene-desktop.mp4");
    expect(media).toContain("scene-mobile.mp4");
    expect(santa).toContain("santa-static.png");
    expect(santa).toContain("santa-alpha.webm");
  });
});

describe("christmas club Wave 1 UI copy", () => {
  it("localizes DE club hero differently from EN", () => {
    expect(clubT("hero.h1", "de")).not.toBe(clubT("hero.h1", "en"));
    expect(clubT("hero.eyebrow", "de")).toMatch(/präsentiert/i);
    expect(clubT("join.cta", "de")).not.toBe(clubT("join.cta", "en"));
    expect(clubT("hero.h1", "fr")).not.toBe(clubT("hero.h1", "en"));
    expect(clubT("join.cta", "pt")).toMatch(/contagem/i);
    expect(clubT("hero.h1", "ro")).toMatch(/Crăciun/i);
    expect(resolveClubLocale("pt-PT")).toBe("pt");
  });

  it("covers required UI keys across Wave 1 packs", () => {
    for (const key of REQUIRED_UI_KEYS) {
      expect(PACKS.en[key]).toBeTruthy();
      expect(clubT(key, "de")).not.toBe(key);
      expect(clubT(key, "de")).not.toBe(clubT(key, "en"));
    }
  });

  it("wires path locale into the club hub page", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/features/christmas/club/ChristmasClubPage.tsx"),
      "utf8",
    );
    expect(page).toContain("parseChristmasLocalePath");
    expect(page).toContain("resolveClubLocale");
    expect(page).toContain('t("hero.h1")');
    expect(page).not.toContain("Something magical is coming this Christmas.");
  });
});

describe("christmas club email validation", () => {
  it("accepts ordinary emails and normalizes case/space", () => {
    expect(normalizeClubEmail("  Ada@TheDigitalGifter.com ")).toBe("ada@thedigitalgifter.com");
    expect(isValidClubEmail("ada@thedigitalgifter.com")).toBe(true);
    expect(clubEmailValidationMessage("ada@thedigitalgifter.com")).toBeNull();
  });

  it("rejects empty and malformed emails", () => {
    expect(isValidClubEmail("")).toBe(false);
    expect(isValidClubEmail("not-an-email")).toBe(false);
    expect(isValidClubEmail("ada@")).toBe(false);
    expect(isValidClubEmail("ada@local")).toBe(false);
    expect(clubEmailValidationMessage("")).toBe("Please enter your email.");
    expect(clubEmailValidationMessage("nope")).toBe("Please enter a valid email.");
    expect(clubEmailValidationMessage("", "de")).toBe(clubT("email.empty", "de"));
    expect(clubEmailValidationMessage("nope", "fr")).toBe(clubT("email.invalid", "fr"));
  });
});

describe("christmas club signup contract", () => {
  it("validates a guest email join", () => {
    const validated = validateChristmasClubSignupPayload({
      email: "Ada@TheDigitalGifter.com",
      signup_method: "email",
      source: "christmas_club_landing",
      campaign_year: 2026,
    });
    expect(validated.email).toBe("ada@thedigitalgifter.com");
    expect(validated.signupMethod).toBe("email");
    expect(validated.campaignYear).toBe(2026);
  });

  it("prefers the authenticated Google email over the client field", () => {
    const validated = validateChristmasClubSignupPayload(
      { email: "other@example.com", signup_method: "google" },
      { authenticatedEmail: "google.user@gmail.com" },
    );
    expect(validated.email).toBe("google.user@gmail.com");
    expect(validated.signupMethod).toBe("google");
  });

  it("requires a valid email when unauthenticated", () => {
    expect(() =>
      validateChristmasClubSignupPayload({ email: "nope", signup_method: "email" }),
    ).toThrow(ChristmasClubSignupError);
  });

  it("treats unique violations as duplicate joins", () => {
    expect(isUniqueViolationStatus(409, "")).toBe(true);
    expect(isUniqueViolationStatus(400, "duplicate key value violates unique constraint")).toBe(
      true,
    );
    expect(isUniqueViolationStatus(500, "server exploded")).toBe(false);
  });

  it("detects a missing signup table so we can fall back safely", () => {
    expect(
      isMissingRelationStatus(
        404,
        `{"code":"PGRST205","message":"Could not find the table 'public.christmas_club_signups' in the schema cache"}`,
      ),
    ).toBe(true);
    expect(isMissingRelationStatus(200, "[]")).toBe(false);
  });
});
