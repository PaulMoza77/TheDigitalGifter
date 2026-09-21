import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAndRenderProduction } from "./worker";
import { ffprobeFile } from "../clip-factory/ffmpeg";

const runHour = process.env.LONG_FORM_HOUR === "1";

describe.skipIf(!runHour)("long-form 1 hour production", () => {
  it("renders a 1h 1080p Christmas ambience with cleared original music", async () => {
    const result = await createAndRenderProduction({
      sceneIds: ["reel-cozy-01", "reel-cozy-02", "reel-cozy-03"],
      mood: "cozy_instrumental",
      style: "cozy",
      durationSeconds: 3600,
      shuffle: true,
      seed: 21,
    });
    expect(result.rendered).toBeTruthy();
    const probe = await ffprobeFile(result.rendered!.outputPath);
    const report = {
      duration: probe.duration,
      width: probe.width,
      height: probe.height,
      hasAudio: probe.hasAudio,
      videoCodec: probe.videoCodec,
      audioCodec: probe.audioCodec,
      fileSize: probe.fileSize,
      tracks: result.rights.manifest.music.length,
      musicSource: result.rights.manifest.music[0]?.source,
      rights: result.production.status,
      librarySrc: result.libraryAsset?.src,
      ffprobe: probe.duration >= 3597.5 && probe.width >= 1920 && probe.hasAudio ? "PASS" : "FAIL",
    };
    await writeFile(join(process.cwd(), "output/long-form/hour-report.json"), JSON.stringify(report, null, 2));
    expect(probe.duration).toBeGreaterThan(3597);
    expect(probe.width).toBeGreaterThanOrEqual(1920);
    expect(probe.height).toBeGreaterThanOrEqual(1080);
    expect(probe.hasAudio).toBe(true);
    expect(result.production.status).toBe("ready_to_publish");
    expect(result.libraryAsset?.src).toContain("long-form");
  }, 1_200_000);
});
