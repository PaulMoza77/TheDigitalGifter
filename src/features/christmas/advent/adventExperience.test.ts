import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "../funnelEventContract";
import {
  adventCountdownParts,
  adventDayParts,
  adventDoorState,
  canClaimAdventDoor,
  msUntilAdventStart,
} from "../tree/treeLogic";
import { doorVariantForDay } from "./assets";
import { adventT, ADVENT_FAQS } from "./copy";
import { adventJsonLd, adventSeo } from "./seo";
import { parseSimDate } from "./adventClient";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("advent immersive rebuild", () => {
  it("ships SEO title/description for online Advent calendar intent", () => {
    const seo = adventSeo("en");
    expect(seo.title.toLowerCase()).toContain("advent");
    expect(seo.description.toLowerCase()).toContain("december");
    expect(seo.url).toContain("/christmas/advent");
    const json = adventJsonLd("en");
    expect(JSON.stringify(json)).toContain("FAQPage");
    expect(ADVENT_FAQS.length).toBeGreaterThanOrEqual(5);
  });

  it("copy pack is translation-ready with interpolation", () => {
    expect(adventT("hero.h1")).toBe("Advent Calendar");
    expect(adventT("progress", "en", { opened: 7 })).toContain("7");
    expect(adventT("door.locked.body", "en", { day: 7 })).toContain("December 7");
  });

  it("door variants cover all 24 days uniquely styled from shared set", () => {
    const variants = Array.from({ length: 24 }, (_, i) => doorVariantForDay(i + 1));
    expect(variants).toHaveLength(24);
    expect(new Set(variants).size).toBeGreaterThan(4);
  });

  it("sim date helper parses YYYY-MM-DD for visual state tests", () => {
    expect(parseSimDate("?sim=2026-12-07")?.toISOString()).toContain("2026-12-07");
    expect(parseSimDate("?foo=1")).toBeNull();
    expect(parseSimDate("?sim=not-a-date")).toBeNull();
  });

  it("Dec 7: doors 1–6 openable, 7 today, 8–24 future", () => {
    const parts = adventDayParts(new Date("2026-12-07T12:00:00+02:00"), 2026);
    expect(parts.eligibleDay).toBe(7);
    expect(adventDoorState({ day: 1, eligibleDay: 7, claimed: false, beforeSeason: false, afterSeason: false })).toBe(
      "openable",
    );
    expect(adventDoorState({ day: 7, eligibleDay: 7, claimed: false, beforeSeason: false, afterSeason: false })).toBe(
      "available",
    );
    expect(adventDoorState({ day: 8, eligibleDay: 7, claimed: false, beforeSeason: false, afterSeason: false })).toBe(
      "future",
    );
    expect(canClaimAdventDoor("openable")).toBe(true);
    expect(canClaimAdventDoor("available")).toBe(true);
    expect(canClaimAdventDoor("future")).toBe(false);
  });

  it("preseason countdown is positive before December", () => {
    const now = new Date("2026-09-09T12:00:00+03:00");
    const ms = msUntilAdventStart(now, 2026);
    expect(ms).toBeGreaterThan(0);
    const parts = adventCountdownParts(ms);
    expect(parts.days).toBeGreaterThan(70);
  });

  it("page experience avoids SaaS card-grid chrome", () => {
    const page = readSrc("src/features/christmas/advent/AdventExperience.tsx");
    const css = readSrc("src/features/christmas/advent/AdventCalendar.css");
    expect(page).toContain("advent-board");
    expect(page).toContain("christmas_advent_door_opened");
    expect(page).not.toContain("no cash credits for anonymous visitors");
    expect(page).not.toContain("Engine ready");
    expect(css).toContain("advent-door");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("grid-template-columns: repeat(4");
  });

  it("registers Advent analytics events", () => {
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_advent_page_view");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_advent_reward_claimed");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_advent_share_clicked");
  });

  it("funnel allows catch-up claims (day <= eligibleDay)", () => {
    const fn = readSrc("supabase/functions/christmas-tree-funnel/index.ts");
    expect(fn).toContain("requestedDay > parts.eligibleDay");
    expect(fn).not.toContain("parts.eligibleDay !== requestedDay");
  });
});
