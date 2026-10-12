import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { availableUpsellPacks } from "./screens/UpsellScreen";

function read(relative: string) {
  return readFileSync(resolve(relative), "utf8");
}

describe("christmas-v2 release hardening regressions", () => {
  it("Edge video worker returns jsonResponse on empty targets (no Express res)", () => {
    const edge = read("supabase/functions/christmas-generate-video/index.ts");
    expect(edge).toContain('return jsonResponse({ ok: true, status: "nothing_to_do", started: 0 })');
    expect(edge).not.toMatch(/return\s+res\.status\(200\)\.json\(/);
  });

  it("progress percent weights entitled videos so Magic/Ultimate stay below 100 until clips finish", () => {
    for (const path of [
      "api/christmas-funnel.ts",
      "supabase/functions/christmas-funnel/index.ts",
    ]) {
      const src = read(path);
      expect(src).toContain("videoProgressSum");
      expect(src).toContain("progressUnits = sceneRows.length + videoRows.length");
      expect(src).toMatch(/status === "generating"\s*\?\s*45/);
    }
  });

  it("order poll waits for terminal status when videoCount > 0", () => {
    const orderPage = read("src/features/christmas-v2/ChristmasV2FunnelPage.tsx");
    expect(orderPage).toContain("orderTerminal");
    expect(orderPage).toContain("imageOnlyReady");
    expect(orderPage).toContain("data.order.videoCount === 0");
    expect(orderPage).toContain("awaitingVideos");
    expect(orderPage).toContain("const done = orderTerminal || imageOnlyReady");
    // Scene progress alone must not complete Magic/Ultimate while clips pending.
    expect(orderPage).toMatch(
      /imageOnlyReady\s*=\s*[\s\S]*?videoCount === 0[\s\S]*?progressPercent >= 100/,
    );
  });

  it("Soul/Kling workers pass statusUrl into poll after submit", () => {
    for (const path of [
      "api/christmas-generate.ts",
      "api/christmas-generate-video.ts",
      "supabase/functions/christmas-generate/index.ts",
      "supabase/functions/christmas-generate-video/index.ts",
    ]) {
      const src = read(path);
      expect(src).toContain("statusUrl = submitted.statusUrl");
      expect(src).toContain("statusUrl,");
    }
  });

  it("account empty state uses EUR pack pricing, not legacy USD $3", () => {
    const account = read("src/components/client/ChristmasGenerations.tsx");
    expect(account).toContain("from €7");
    expect(account).not.toContain("$3");
    expect(account).not.toContain("$8");
    expect(account).not.toContain("$12");
  });

  it("Christmas V2 upsells are pack upgrades only — no Golden Frame / regenerate SKUs", () => {
    expect(availableUpsellPacks("starter")).toEqual(["magic", "ultimate"]);
    expect(availableUpsellPacks("magic")).toEqual(["ultimate"]);
    expect(availableUpsellPacks("ultimate")).toEqual([]);
    const upsell = read("src/features/christmas-v2/screens/UpsellScreen.tsx");
    expect(upsell.toLowerCase()).not.toContain("golden frame");
    expect(upsell.toLowerCase()).not.toContain("regenerate");
    const offers = read("src/features/christmas-v2/offers.ts");
    expect(offers.toLowerCase()).not.toContain("golden_frame");
    expect(offers).not.toContain("offer_golden_frame");
  });

  it("Christmas V2 generate workers do not call Replicate runtime APIs", () => {
    for (const path of [
      "api/christmas-generate.ts",
      "api/christmas-generate-video.ts",
      "supabase/functions/christmas-generate/index.ts",
      "supabase/functions/christmas-generate-video/index.ts",
      "api/_lib/christmas/higgsfieldProviders.ts",
    ]) {
      const src = read(path);
      expect(src.toLowerCase()).not.toContain("api.replicate.com");
      expect(src).not.toMatch(/from\s+["']replicate["']/);
    }
  });

  it("release checklist documents merge order and production blockers", () => {
    const checklist = read("scripts/christmas-v2-release-checklist.md");
    expect(checklist).toContain("#356");
    expect(checklist).toContain("#357");
    expect(checklist).toContain("NO-GO");
    expect(checklist).toContain("20261012130000_hotfix_admin_role_escalation.sql");
    expect(checklist).toContain("VAT");
    expect(checklist).toContain("Contabo");
  });
});
