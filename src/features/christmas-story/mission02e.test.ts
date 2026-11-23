import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_GIFT } from "./data/demoGift";

const root = resolve(process.cwd());

describe("Mission 02E — premium demo + media quality", () => {
  it("demo film is nontrivial photographic media, not a 42KB plate test", () => {
    const mp4 = resolve(root, "public/assets/christmas-story-demo/emma-memory-film.mp4");
    expect(existsSync(mp4)).toBe(true);
    expect(statSync(mp4).size).toBeGreaterThan(500_000);
    const stills = resolve(root, "public/assets/christmas-story-demo/stills/MANIFEST.json");
    expect(existsSync(stills)).toBe(true);
    const man = JSON.parse(readFileSync(stills, "utf8"));
    expect(Array.isArray(man.stills)).toBe(true);
    expect(man.stills.length).toBeGreaterThanOrEqual(6);
  });

  it("ships warm_cinematic_v2 with crossfades and Christmas grade", () => {
    const film = readFileSync(resolve(root, "server/christmas-story-media/ffmpegFilm.ts"), "utf8");
    expect(film).toContain("warm_cinematic_v2");
    expect(film).toContain("xfade");
    expect(film).toContain("colorbalance");
  });

  it("keeps demo song unavailable without fake playback", () => {
    expect(DEMO_GIFT.song.audioUrl).toBeNull();
    expect(DEMO_GIFT.song.status).toBe("pending");
    const player = readFileSync(
      resolve(root, "src/features/christmas-story/components/ExampleAudioPlayer.tsx"),
      "utf8",
    );
    expect(player).toContain("no playback until an authorized commercial master");
    expect(existsSync(resolve(root, "docs/christmas-story/DEMO_SONG_OPERATOR_CHECKLIST.md"))).toBe(
      true,
    );
  });

  it("labels the sample honestly and shows a film poster on landing", () => {
    expect(DEMO_GIFT.storyParagraphs.join(" ")).toMatch(/stock photography|fictional/i);
    const landing = readFileSync(
      resolve(root, "src/features/christmas-story/components/StoryLanding.tsx"),
      "utf8",
    );
    expect(landing).toContain("emma-poster.jpg");
    expect(landing).toContain("Stock photos");
  });

  it("packages an isolated worker without deploying it", () => {
    expect(existsSync(resolve(root, "server/christmas-story-media/worker/Dockerfile"))).toBe(true);
    expect(existsSync(resolve(root, "server/christmas-story-media/worker/ENV_CONTRACT.md"))).toBe(
      true,
    );
    const df = readFileSync(resolve(root, "server/christmas-story-media/worker/Dockerfile"), "utf8");
    expect(df).toContain("HEALTHCHECK");
    expect(df).toContain("Do NOT deploy");
  });
});
