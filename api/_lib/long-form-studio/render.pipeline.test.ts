import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAndRenderProduction } from "./worker";
import { ensureAllOriginalMusic } from "./originalMusic";
import { ffprobeFile } from "../clip-factory/ffmpeg";

describe("long-form render pipeline", () => {
  it("renders a short 16:9 ambience with cleared original music and a rights manifest", async () => {
    await ensureAllOriginalMusic();
    const dir = await mkdtemp(join(tmpdir(), "tdg-lf-"));
    try {
      const result = await createAndRenderProduction(
        {
          sceneIds: ["reel-cozy-01", "reel-cozy-03"],
          mood: "cozy_instrumental",
          style: "cozy",
          durationSeconds: 12,
          shuffle: true,
          seed: 3,
        },
        { workDir: dir },
      );
      expect(result.rights.ok).toBe(true);
      expect(result.production.status).toBe("ready_to_publish");
      expect(result.rendered?.probe.width).toBeGreaterThanOrEqual(1920);
      expect(result.rendered?.probe.height).toBeGreaterThanOrEqual(1080);
      expect(result.rendered?.probe.hasAudio).toBe(true);
      expect(result.rendered?.probe.duration).toBeGreaterThan(10);
      expect(result.libraryAsset?.src).toContain("/api/long-form-studio");
      const probe = await ffprobeFile(result.rendered!.outputPath);
      expect(probe.videoCodec).toBe("h264");
      expect(probe.audioCodec).toMatch(/aac/i);
      expect(result.rights.manifest.music[0]?.source).toBe("original_owned");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 180_000);
});
