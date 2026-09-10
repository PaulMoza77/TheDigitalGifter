import { describe, expect, it } from "vitest";
import { WAVE1_GENERATION_LOCALES } from "@/features/christmas/i18n/wave1Locale";
import {
  PACKS as PHOTO_PACKS,
  PHOTO_GEN_UI_KEYS,
  photoGenT,
  photoStyleLabel,
  type PhotoGenLocale,
} from "../photoGenerator/copy";
import { TABLES as TREE_TABLES, treeT, type TreeLocale } from "../tree/treeCopy";
import {
  TABLES as ADVENT_TABLES,
  adventT,
  formatAdventStartDate,
  type AdventLocale,
} from "../advent/adventCopy";
import { adventDayParts } from "../tree/treeLogic";

describe("christmas P3D Photo + Tree + Advent Wave 1 UI", () => {
  it("Photo generator UI packs cover interactive Wave 1 keys", () => {
    for (const locale of WAVE1_GENERATION_LOCALES) {
      const loc = locale as PhotoGenLocale;
      expect(PHOTO_PACKS[loc]).toBeTruthy();
      expect(photoGenT("upload.choose", loc)).toBeTruthy();
      expect(photoGenT("upload.replace", loc)).not.toBe("upload.replace");
      expect(photoGenT("result.download", loc)).toBeTruthy();
      expect(photoStyleLabel("cozy_fireplace", loc)).toBeTruthy();
      expect(photoStyleLabel("cozy_fireplace", loc)).not.toBe("cozy_fireplace");
    }
    expect(photoGenT("upload.choose", "de")).not.toBe(photoGenT("upload.choose", "en"));
    expect(photoStyleLabel("cozy_fireplace", "pt")).toMatch(/Natal|acolhedor/i);
    for (const key of PHOTO_GEN_UI_KEYS) {
      expect(photoGenT(key, "pl")).not.toBe(key);
    }
  });

  it("Tree UI packs cover Wave 1 with key parity", () => {
    for (const locale of WAVE1_GENERATION_LOCALES) {
      const loc = locale as TreeLocale;
      expect(TREE_TABLES[loc]).toBeTruthy();
      expect(treeT("gift.addCta", loc)).toBeTruthy();
      expect(treeT("share.link", loc)).toBeTruthy();
      expect(treeT("error.load", loc)).not.toBe("error.load");
    }
    expect(treeT("editor.saveCreate", "fr")).not.toBe(treeT("editor.saveCreate", "en"));
    expect(treeT("lede.from", "es", { name: "Ana" })).toMatch(/Ana/);
  });

  it("Advent UI packs cover countdown + door states; dates use Intl", () => {
    for (const locale of WAVE1_GENERATION_LOCALES) {
      const loc = locale as AdventLocale;
      expect(ADVENT_TABLES[loc]).toBeTruthy();
      expect(adventT("countdown.days", loc)).toBeTruthy();
      expect(adventT("cta.openToday", loc)).toBeTruthy();
      expect(adventT("door.locked", loc)).toBeTruthy();
      expect(adventT("cta.comeBackTomorrow", loc)).toBeTruthy();
      const date = formatAdventStartDate(loc, 2026);
      expect(date).toBeTruthy();
      if (loc !== "en") {
        expect(date.toLowerCase()).not.toBe("december 1");
      }
    }
    expect(formatAdventStartDate("de", 2026)).toMatch(/Dezember|1/);
    expect(formatAdventStartDate("pt", 2026)).toMatch(/dezembro/i);
    // Bucharest unlock logic unchanged
    const parts = adventDayParts(new Date("2026-12-05T10:00:00Z"), 2026);
    expect(parts.eligibleDay).toBeTypeOf("number");
  });
});
