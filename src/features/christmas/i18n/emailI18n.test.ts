import { describe, expect, it } from "vitest";
import {
  christmasV2DeliveryEmailCopy,
  normalizeEmailLocale,
} from "../../../../api/_lib/christmas/emailI18n";

describe("christmas V2 delivery email i18n", () => {
  it("defaults unknown locale to EN and localizes RO", () => {
    expect(normalizeEmailLocale(undefined)).toBe("en");
    expect(normalizeEmailLocale("ro-RO")).toBe("ro");
    const en = christmasV2DeliveryEmailCopy("en", {
      packKey: "starter",
      packName: "Starter Pack",
      imageCount: 3,
      videoCount: 1,
    });
    const ro = christmasV2DeliveryEmailCopy("ro", {
      packKey: "starter",
      packName: "Starter Pack",
      imageCount: 3,
      videoCount: 1,
    });
    expect(en.subject).toMatch(/ready/i);
    expect(ro.subject).toMatch(/gata/i);
    expect(en.cta).not.toEqual(ro.cta);
    expect(en.body).toContain("video");
    expect(ro.body).toContain("videoclip");
  });
});
