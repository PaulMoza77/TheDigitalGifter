/**
 * Local-only visual/E2E fixture for Christmas V2 post-purchase screens.
 * Never implies a real Stripe payment or paid AI generation.
 */

import type { ChristmasSceneResult, ChristmasVideoResult } from "./api";
import { CHRISTMAS_STARTER_SCENES, type ChristmasPackKey } from "./config";

export const CHRISTMAS_V2_FIXTURE_BANNER =
  "TEST FIXTURE — not a real payment or AI generation" as const;

export type ChristmasV2OrderFixtureMode = "generating" | "results" | "upsell" | "error";

export function parseChristmasV2OrderFixture(
  search: string,
): { mode: ChristmasV2OrderFixtureMode; packKey: ChristmasPackKey } | null {
  const params = new URLSearchParams(search);
  if (params.get("fixture") !== "1" && params.get("fixture") !== "true") return null;
  const rawMode = String(params.get("demo") || "results").toLowerCase();
  const mode: ChristmasV2OrderFixtureMode =
    rawMode === "generating" || rawMode === "upsell" || rawMode === "error"
      ? rawMode
      : "results";
  const packRaw = String(params.get("pack") || "starter").toLowerCase();
  const packKey: ChristmasPackKey =
    packRaw === "magic" || packRaw === "ultimate" ? packRaw : "starter";
  return { mode, packKey };
}

/** Synthetic placeholder images (SVG data URLs) — no customer photos. */
export function fixtureSceneResults(count = 3): ChristmasSceneResult[] {
  const scenes = CHRISTMAS_STARTER_SCENES.slice(0, Math.max(1, count));
  return scenes.map((scene, index) => ({
    sceneKey: scene.key,
    title: scene.label,
    status: "succeeded",
    imageUrl: fixturePortraitDataUrl(scene.shortLabel, index),
  }));
}

export function fixtureVideoResults(count = 0): ChristmasVideoResult[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => ({
    id: `fixture-video-${index + 1}`,
    status: "succeeded",
    videoUrl: null,
    sourceSceneKey:
      CHRISTMAS_STARTER_SCENES[index % CHRISTMAS_STARTER_SCENES.length]?.key ||
      "by-the-christmas-tree",
  }));
}

function fixturePortraitDataUrl(label: string, seed: number): string {
  const hues = [12, 145, 38];
  const hue = hues[seed % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue} 35% 22%)"/>
        <stop offset="100%" stop-color="hsl(${hue} 40% 12%)"/>
      </linearGradient>
    </defs>
    <rect width="480" height="640" fill="url(#g)"/>
    <circle cx="240" cy="250" r="88" fill="hsl(40 45% 72%)" opacity="0.85"/>
    <rect x="150" y="360" width="180" height="220" rx="90" fill="hsl(150 30% 28%)"/>
    <text x="240" y="580" text-anchor="middle" fill="#F7F0E4" font-family="Georgia, serif" font-size="28">${escapeXml(label)}</text>
    <text x="240" y="40" text-anchor="middle" fill="#C9A227" font-family="sans-serif" font-size="14">FIXTURE</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
