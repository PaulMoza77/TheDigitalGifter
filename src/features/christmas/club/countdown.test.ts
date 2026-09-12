import { describe, expect, it } from "vitest";
import { CHRISTMAS_CLUB_CONFIG } from "./config";
import {
  getChristmasTargetMs,
  padCountdownValue,
  remainingUntilChristmas,
  zonedWallTimeMs,
} from "./countdown";

describe("christmas club countdown", () => {
  it("computes remaining parts from a live now, not hardcoded display numbers", () => {
    const config = { ...CHRISTMAS_CLUB_CONFIG, timeZone: "UTC" as const };
    const now = new Date("2026-12-01T01:02:03.000Z");
    const remaining = remainingUntilChristmas(now, config);
    expect(remaining.expired).toBe(false);
    expect(remaining.days).toBe(23);
    expect(remaining.hours).toBe(22);
    expect(remaining.minutes).toBe(57);
    expect(remaining.seconds).toBe(57);
    expect(remaining.totalMs).toBeGreaterThan(0);
  });

  it("transitions to Christmas state instead of negative numbers", () => {
    const config = { ...CHRISTMAS_CLUB_CONFIG, timeZone: "UTC" as const };
    const now = new Date("2026-12-25T00:00:00.000Z");
    const remaining = remainingUntilChristmas(now, config);
    expect(remaining.expired).toBe(true);
    expect(remaining.days).toBe(0);
    expect(remaining.hours).toBe(0);
    expect(remaining.minutes).toBe(0);
    expect(remaining.seconds).toBe(0);
    expect(remaining.totalMs).toBe(0);
  });

  it("stays in Christmas state after the target", () => {
    const config = { ...CHRISTMAS_CLUB_CONFIG, timeZone: "UTC" as const };
    const remaining = remainingUntilChristmas(new Date("2027-01-02T12:00:00.000Z"), config);
    expect(remaining.expired).toBe(true);
    expect(remaining.days).toBe(0);
  });

  it("resolves Europe/Bucharest midnight without scattering the date", () => {
    const config = {
      ...CHRISTMAS_CLUB_CONFIG,
      timeZone: "Europe/Bucharest",
    };
    const target = getChristmasTargetMs(config, new Date("2026-12-01T00:00:00Z"));
    const expected = zonedWallTimeMs(config, "Europe/Bucharest");
    expect(target).toBe(expected);
    const bucharest = remainingUntilChristmas(new Date(expected - 1000), config);
    expect(bucharest.expired).toBe(false);
    expect(bucharest.seconds).toBe(1);
    expect(remainingUntilChristmas(new Date(expected), config).expired).toBe(true);
  });

  it("uses the visitor's local Christmas morning for the default config", () => {
    const localChristmas = new Date(2026, 11, 25, 0, 0, 0, 0);
    expect(remainingUntilChristmas(localChristmas).expired).toBe(true);
    expect(remainingUntilChristmas(new Date(localChristmas.getTime() - 1000)).expired).toBe(false);
    expect(remainingUntilChristmas(new Date(localChristmas.getTime() - 1000)).seconds).toBe(1);
  });

  it("pads compact countdown units", () => {
    expect(padCountdownValue(4)).toBe("04");
    expect(padCountdownValue(24)).toBe("24");
    expect(padCountdownValue(108)).toBe("108");
  });

  it("keeps the campaign year in one config object", () => {
    expect(CHRISTMAS_CLUB_CONFIG.campaignYear).toBe(2026);
    expect(CHRISTMAS_CLUB_CONFIG.month).toBe(12);
    expect(CHRISTMAS_CLUB_CONFIG.day).toBe(25);
  });
});
